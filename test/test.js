var gasAmount = 4000000;
var baseTokenPrice = web3.toWei(0.001, "Ether");

// Multisig address
var multisig = "0xaec3ae5d2be00bfc91597d7a1b2c43818d84396a";

contract('HumaniqICO', function(accounts) {
    // Owner of the contract
    var icoOwner = accounts[0];
    // Regular HumaniQ investor
    var icoInvestor = accounts[1];

    it("Should start ICO", function(done) {
        // ICO Contract
        var icoContract = HumaniqICO.deployed();

        return icoContract.isICOActive.call({
            from: icoOwner
        }).then(function(isICOActive) {
            // check that ICO is not active yet
            assert.equal(isICOActive, false, "ICO is already activated");
            return icoContract.startICO({
                from: icoOwner,
                gas: gasAmount
            });
        }).then(function(tx_id) {
            return icoContract.isICOActive.call({
                from: icoOwner
            });
        }).then(function(isICOActive) {
            // check that ICO was successfuly activated
            assert.equal(isICOActive, true, "ICO is not active");
        }).then(done);
    });

    it("Should invest 10 ETH", function(done) {
        // ICO Contract
        var icoContract = HumaniqICO.deployed();
        // Token contract
        var tokenContract = HumaniqToken.deployed();

        var bonus = 1.499; // we just started the ICO, therefore 49.9% bonus must be applied

        // first of all we allow the contract to emit new tokens
        tokenContract.changeEmissionContractAddress(icoContract.address, {
            from: icoOwner, // only owner can call this function
            gas: gasAmount
        }).then(function(tx_id) {
            return tokenContract.emissionContractAddress.call();
        }).then(function(emissionContractAddress) {
            // check that emissionContractAddress was successfuly changed
            assert.equal(emissionContractAddress, icoContract.address, "emissionContractAddress wasn't changed");
        });

        // save initial balance of the investor
        var initialBalance = web3.fromWei(web3.eth.getBalance(icoInvestor), "Ether");
        assert.isAtLeast(initialBalance.toNumber(), 10, "Not enough money");

        // make sure that he doesn't have any tokens so far
        var tokens = tokenContract.balanceOf.call(icoInvestor).then(function(balance) {
            assert.equal(balance.toNumber(), 0, "Not null balance");
        });

        // invest 10 ETH using function fund()
        return icoContract.fund({
            from: icoInvestor,
            gas: gasAmount,
            value: web3.toWei(10, "Ether")
        }).then(function(tx_id) {
            return tokenContract.balanceOf.call(icoInvestor);
        }).then(function(balance) {
            // check that investor spent 10 ethers
            var accountBalance = web3.fromWei(web3.eth.getBalance(icoInvestor), "Ether");
            assert.closeTo(accountBalance.toNumber(),
                initialBalance - 10,
                0.1, // some ethers were spent on gas
                "Wrong number of ether was spent");

            // check that investor received correct number of tokens
            assert.closeTo(balance.toNumber(),
                (web3.toWei(10, "Ether") / baseTokenPrice) * bonus,
                0.0000001, // possible javascript computational error
                "Wrong number of tokens was given");

            return tokenContract.totalSupply.call();
        }).then(function(totalSupply) {
            // check that totalSupply of tokens is correct
            assert.closeTo(totalSupply.toNumber(),
                (web3.toWei(10, "Ether") / baseTokenPrice) * bonus,
                0.0000001, // possible javascript computational error
                "Wrong total supply");
            return icoContract.icoBalance.call();
        }).then(function(icoBalance) {
            // check that ICO balance is correct
            assert.equal(icoBalance.toNumber(), web3.toWei(10, "Ether"), "Wrong ICO balance");
        }).then(done)
    });

    it("Should invest 5 ETH via fundBTC()", function(done) {
        // ICO Contract
        var icoContract = HumaniqICO.deployed();
        // Token contract
        var tokenContract = HumaniqToken.deployed();

        // we just started the ICO, therefore 49.9% bonus must be applied
        var bonus = 1.499;

        // save initial balance of the investor
        var initialBalance = web3.fromWei(web3.eth.getBalance(icoInvestor), "Ether");
        assert.isAtLeast(initialBalance.toNumber(), 10, "Not enough money");

        var initialTokens, initialTokenSupply, initialICOBalance;

        tokenContract.balanceOf.call(icoInvestor).then(function(balance) {
            // save initial tokens
            initialTokens = balance.toNumber();
            return tokenContract.totalSupply.call();
        }).then(function(totalSupply) {
            // save initial token supply
            initialTokenSupply = totalSupply.toNumber();
            return icoContract.icoBalance.call();
        }).then(function(icoBalance) {
            // save initial ICO balance
            initialICOBalance = icoBalance.toNumber();
            // fix 5 ETH investment using fundBTC()
            return icoContract.fundBTC(icoInvestor, // beneficiary
                web3.toWei(5, "Ether"), {
                    from: icoOwner, // only owner can call this function
                    gas: gasAmount
                });
        }).then(function() {
            return tokenContract.balanceOf.call(icoInvestor);
        }).then(function(balance) {
            // check that beneficiary received correct number of tokens
            assert.closeTo(balance.toNumber(),
                initialTokens + (web3.toWei(5, "Ether") / baseTokenPrice) * bonus,
                0.0000001, // possible javascript computational error
                "Wrong number of tokens was given");

            return tokenContract.totalSupply.call();
        }).then(function(totalSupply) {
            // check that totalSupply of tokens is correct
            assert.closeTo(totalSupply.toNumber(),
                initialTokenSupply + (web3.toWei(5, "Ether") / baseTokenPrice) * bonus,
                0.0000001, // possible javascript computational error
                "Wrong total supply");
            return icoContract.icoBalance.call();
        }).then(function(icoBalance) {
            // check that ICO balance is correct
            assert.equal(icoBalance.toNumber(),
                initialICOBalance + parseInt(web3.toWei(5, "Ether")),
                "Wrong ICO balance");
        }).then(done);
    });

    it("Should return current bonus", function(done) {
        var icoContract = HumaniqICO.deployed();

        return icoContract.getBonus.call({
            from: icoOwner
        }).then(function(discount) {
            // check that getBonus() returns correct value
            assert.equal((discount - 1000) / 10, 49.9, "Wrong bonus");
        }).then(done);
    });

    it("Should finish crowdsale and allocate founder bonus", function(done) {
        // ICO Contract
        var icoContract = HumaniqICO.deployed();
        // Token contract
        var tokenContract = HumaniqToken.deployed();

        var icoTotalBalance = 0;
        var totalCoinsIssued = 0;

        return icoContract.coinsIssued.call().then(function(coinsIssued) {
            // save total number of tokens
            totalCoinsIssued = coinsIssued.toNumber();

            return icoContract.icoBalance.call();
        }).then(function(icoBalance) {
            // save ICO total balance
            icoTotalBalance = icoBalance.toNumber();

            // finish crowdsale
            return icoContract.finishCrowdsale({
                from: icoOwner,
                gas: gasAmount,
                value: 0
            });
        }).then(function(tx_id) {
            return icoContract.isICOActive.call();
        }).then(function(isICOActive) {
            // check that ICO was closed
            assert.equal(isICOActive, false, "ICO wasn't closed");
            
            return tokenContract.balanceOf.call(multisig);
        }).then(function(founderTokens) {
            // founders are supposed to receive 14% of all issued tokens
            var founderBonus = Math.floor((totalCoinsIssued / 86) * 14);

            // check that founders received proper number of tokens
            assert.equal(founderBonus, founderTokens.toNumber(), "Founders were not allocated with proper number of coins");
        }).then(done);
    });

});
