#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Symbol, Address, Env, Map};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Splits {
    pub producer_pct: u32,
    pub maintenance_pct: u32,
    pub buyer_pool_pct: u32,
}

#[contracttype]
pub enum DataKey {
    Admin,
    RegistryAddress,
    Splits,
    Balances,
    BuyerPoolBalance,
}

#[contract]
pub struct PayoutSplitter;

#[contractimpl]
impl PayoutSplitter {
    pub fn initialize(env: Env, admin: Address, registry_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RegistryAddress, &registry_address);
        
        let default_splits = Splits {
            producer_pct: 70,
            maintenance_pct: 15,
            buyer_pool_pct: 15,
        };
        env.storage().instance().set(&DataKey::Splits, &default_splits);
        env.storage().instance().set(&DataKey::BuyerPoolBalance, &0i128);
        
        let balances: Map<Address, i128> = Map::new(&env);
        env.storage().instance().set(&DataKey::Balances, &balances);
    }

    pub fn settle(env: Env, producer: Address, amount: i128) {
        let registry: Address = env.storage().instance().get(&DataKey::RegistryAddress).expect("not initialized");
        registry.require_auth();

        let splits: Splits = env.storage().instance().get(&DataKey::Splits).expect("splits not set");
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("admin not set");

        let producer_share = (amount * splits.producer_pct as i128) / 100;
        let maintenance_share = (amount * splits.maintenance_pct as i128) / 100;
        let buyer_pool_share = amount - producer_share - maintenance_share;

        let mut balances: Map<Address, i128> = env.storage().instance().get(&DataKey::Balances).unwrap_or_else(|| Map::new(&env));

        // Credit producer
        let prod_bal = balances.get(producer.clone()).unwrap_or(0);
        balances.set(producer.clone(), prod_bal + producer_share);

        // Credit admin (maintenance)
        let admin_bal = balances.get(admin.clone()).unwrap_or(0);
        balances.set(admin.clone(), admin_bal + maintenance_share);

        env.storage().instance().set(&DataKey::Balances, &balances);

        // Credit buyer pool
        let pool_bal: i128 = env.storage().instance().get(&DataKey::BuyerPoolBalance).unwrap_or(0);
        env.storage().instance().set(&DataKey::BuyerPoolBalance, &(pool_bal + buyer_pool_share));

        // Emit event: ("payout_settled", producer, amount)
        env.events().publish(
            (Symbol::new(&env, "payout_settled"), producer),
            amount
        );
    }

    pub fn buyer_deposit(env: Env, buyer: Address, amount: i128) {
        buyer.require_auth();

        let pool_bal: i128 = env.storage().instance().get(&DataKey::BuyerPoolBalance).unwrap_or(0);
        env.storage().instance().set(&DataKey::BuyerPoolBalance, &(pool_bal + amount));

        // Emit event: ("buyer_deposit", buyer, amount)
        env.events().publish(
            (Symbol::new(&env, "buyer_deposit"), buyer),
            amount
        );
    }

    pub fn set_splits(env: Env, admin: Address, producer_pct: u32, maintenance_pct: u32, buyer_pool_pct: u32) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized admin");
        }

        if producer_pct + maintenance_pct + buyer_pool_pct != 100 {
            panic!("splits must sum to 100");
        }

        let new_splits = Splits {
            producer_pct,
            maintenance_pct,
            buyer_pool_pct,
        };
        env.storage().instance().set(&DataKey::Splits, &new_splits);
    }

    pub fn get_balance(env: Env, address: Address) -> i128 {
        if address == env.current_contract_address() {
            env.storage().instance().get(&DataKey::BuyerPoolBalance).unwrap_or(0)
        } else {
            let balances: Map<Address, i128> = env.storage().instance().get(&DataKey::Balances).unwrap_or_else(|| Map::new(&env));
            balances.get(address).unwrap_or(0)
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup_test<'a>() -> (Env, Address, Address, PayoutSplitterClient<'a>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, PayoutSplitter);
        let client = PayoutSplitterClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        (env, admin, registry, client)
    }

    #[test]
    fn test_split_math_70_15_15() {
        let (env, admin, registry, client) = setup_test();
        client.initialize(&admin, &registry);

        let producer = Address::generate(&env);
        let amount = 1000i128;

        client.settle(&producer, &amount);

        assert_eq!(client.get_balance(&producer), 700);
        assert_eq!(client.get_balance(&admin), 150);
        assert_eq!(client.get_balance(&client.address), 150);
    }

    #[test]
    fn test_split_math_100_0_0() {
        let (env, admin, registry, client) = setup_test();
        client.initialize(&admin, &registry);

        client.set_splits(&admin, &100, &0, &0);

        let producer = Address::generate(&env);
        let amount = 1000i128;

        client.settle(&producer, &amount);

        assert_eq!(client.get_balance(&producer), 1000);
        assert_eq!(client.get_balance(&admin), 0);
        assert_eq!(client.get_balance(&client.address), 0);
    }

    #[test]
    #[should_panic]
    fn test_non_registry_caller_rejected_on_settle() {
        let env = Env::default();
        // Notice we do NOT mock all auths here, so checking for registry auth will fail
        let contract_id = env.register_contract(None, PayoutSplitter);
        let client = PayoutSplitterClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        client.initialize(&admin, &registry);

        let producer = Address::generate(&env);
        // This should panic because registry auth is required but registry didn't sign the call
        client.settle(&producer, &1000i128);
    }
}
