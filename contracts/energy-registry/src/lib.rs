#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, String, IntoVal};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Asset {
    pub owner: Address,
    pub name: String,
    pub capacity: u32,
    pub cumulative_production: u64,
    pub credits_minted: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Reporter,
    Asset(u64),
    NextAssetId,
    Splitter,
}

#[contract]
pub struct EnergyRegistry;

#[contractimpl]
impl EnergyRegistry {
    pub fn initialize(env: Env, admin: Address, reporter: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Reporter, &reporter);
        env.storage().instance().set(&DataKey::NextAssetId, &1u64);
    }

    pub fn register_asset(env: Env, owner: Address, name: String, capacity: u32) -> u64 {
        owner.require_auth();
        
        if !env.storage().instance().has(&DataKey::Admin) {
            panic!("not initialized");
        }

        let next_id: u64 = env.storage().instance().get(&DataKey::NextAssetId).unwrap_or(1u64);
        
        let asset = Asset {
            owner: owner.clone(),
            name,
            capacity,
            cumulative_production: 0,
            credits_minted: 0,
        };
        
        env.storage().instance().set(&DataKey::Asset(next_id), &asset);
        env.storage().instance().set(&DataKey::NextAssetId, &(next_id + 1));
        
        // Emit event: ("asset_registered", asset_id, owner)
        env.events().publish(
            (Symbol::new(&env, "asset_registered"), next_id),
            owner
        );
        
        next_id
    }

    pub fn report_production(env: Env, asset_id: u64, amount: u64, reporter: Address) {
        reporter.require_auth();
        
        let stored_reporter: Address = env.storage().instance().get(&DataKey::Reporter).expect("not initialized");
        if reporter != stored_reporter {
            panic!("unauthorized reporter");
        }
        
        let asset_key = DataKey::Asset(asset_id);
        let mut asset: Asset = env.storage().instance().get(&asset_key).expect("asset not found");
        
        asset.cumulative_production += amount;
        
        // Emit event: ("production_reported", asset_id, amount)
        env.events().publish(
            (Symbol::new(&env, "production_reported"), asset_id),
            amount
        );
        
        let new_credits = asset.cumulative_production / 1000;
        let old_credits = asset.credits_minted;
        
        if new_credits > old_credits {
            let credits_minted_now = new_credits - old_credits;
            asset.credits_minted = new_credits;
            
            // Emit event: ("credits_minted", asset_id, amount)
            env.events().publish(
                (Symbol::new(&env, "credits_minted"), asset_id),
                credits_minted_now
            );
            
            // Call payout-splitter::settle(owner, credits_minted_now)
            if let Some(splitter_address) = env.storage().instance().get::<_, Address>(&DataKey::Splitter) {
                let amount_i128 = credits_minted_now as i128;
                let args = soroban_sdk::vec![&env, asset.owner.clone().into_val(&env), amount_i128.into_val(&env)];
                env.invoke_contract::<()>(
                    &splitter_address,
                    &symbol_short!("settle"),
                    args
                );
            }
        }
        
        env.storage().instance().set(&asset_key, &asset);
    }

    pub fn set_reporter(env: Env, admin: Address, new_reporter: Address) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized admin");
        }
        env.storage().instance().set(&DataKey::Reporter, &new_reporter);
    }

    pub fn get_asset(env: Env, asset_id: u64) -> Asset {
        env.storage().instance().get(&DataKey::Asset(asset_id)).expect("asset not found")
    }

    pub fn set_splitter(env: Env, admin: Address, splitter: Address) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        if admin != stored_admin {
            panic!("unauthorized admin");
        }
        env.storage().instance().set(&DataKey::Splitter, &splitter);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String};

    #[contract]
    pub struct MockPayoutSplitter;

    #[contractimpl]
    impl MockPayoutSplitter {
        pub fn settle(env: Env, producer: Address, amount: i128) {
            env.storage().instance().set(&symbol_short!("called"), &true);
            env.storage().instance().set(&symbol_short!("prod"), &producer);
            env.storage().instance().set(&symbol_short!("amt"), &amount);
        }

        pub fn get_called(env: Env) -> bool {
            env.storage().instance().get(&symbol_short!("called")).unwrap_or(false)
        }

        pub fn get_prod(env: Env) -> Address {
            env.storage().instance().get(&symbol_short!("prod")).unwrap()
        }

        pub fn get_amt(env: Env) -> i128 {
            env.storage().instance().get(&symbol_short!("amt")).unwrap_or(0i128)
        }
    }

    fn setup_test<'a>() -> (Env, Address, Address, EnergyRegistryClient<'a>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, EnergyRegistry);
        let client = EnergyRegistryClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let reporter = Address::generate(&env);
        (env, admin, reporter, client)
    }

    #[test]
    fn test_register_success() {
        let (env, admin, reporter, client) = setup_test();
        client.initialize(&admin, &reporter);

        let owner = Address::generate(&env);
        let name = String::from_str(&env, "Solar Array A");
        let capacity = 500u32;

        let asset_id = client.register_asset(&owner, &name, &capacity);
        assert_eq!(asset_id, 1);

        let asset = client.get_asset(&asset_id);
        assert_eq!(asset.owner, owner);
        assert_eq!(asset.name, name);
        assert_eq!(asset.capacity, capacity);
        assert_eq!(asset.cumulative_production, 0);
        assert_eq!(asset.credits_minted, 0);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_duplicate_invalid_reject() {
        let (_, admin, reporter, client) = setup_test();
        client.initialize(&admin, &reporter);
        client.initialize(&admin, &reporter);
    }

    #[test]
    #[should_panic(expected = "unauthorized reporter")]
    fn test_non_reporter_rejected() {
        let (env, admin, reporter, client) = setup_test();
        client.initialize(&admin, &reporter);

        let owner = Address::generate(&env);
        let name = String::from_str(&env, "Solar Array B");
        let asset_id = client.register_asset(&owner, &name, &100);

        let invalid_reporter = Address::generate(&env);
        client.report_production(&asset_id, &500, &invalid_reporter);
    }

    #[test]
    fn test_threshold_mint_triggers_correctly() {
        let (env, admin, reporter, client) = setup_test();
        client.initialize(&admin, &reporter);

        let owner = Address::generate(&env);
        let name = String::from_str(&env, "Solar Array C");
        let asset_id = client.register_asset(&owner, &name, &100);

        client.report_production(&asset_id, &900, &reporter);
        let mut asset = client.get_asset(&asset_id);
        assert_eq!(asset.cumulative_production, 900);
        assert_eq!(asset.credits_minted, 0);

        client.report_production(&asset_id, &200, &reporter);
        asset = client.get_asset(&asset_id);
        assert_eq!(asset.cumulative_production, 1100);
        assert_eq!(asset.credits_minted, 1);

        client.report_production(&asset_id, &2000, &reporter);
        asset = client.get_asset(&asset_id);
        assert_eq!(asset.cumulative_production, 3100);
        assert_eq!(asset.credits_minted, 3);
    }

    #[test]
    fn test_cross_contract_call_fires() {
        let (env, admin, reporter, client) = setup_test();
        client.initialize(&admin, &reporter);

        let mock_splitter_id = env.register_contract(None, MockPayoutSplitter);
        client.set_splitter(&admin, &mock_splitter_id);

        let owner = Address::generate(&env);
        let name = String::from_str(&env, "Solar Array D");
        let asset_id = client.register_asset(&owner, &name, &100);

        client.report_production(&asset_id, &1500, &reporter);

        let splitter_client = MockPayoutSplitterClient::new(&env, &mock_splitter_id);
        assert!(splitter_client.get_called());
        assert_eq!(splitter_client.get_prod(), owner);
        assert_eq!(splitter_client.get_amt(), 1);
    }
}
