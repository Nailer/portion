# Account connection after the rebrand

The web app never asks visitors to paste or reveal a recovery phrase or private key. The former phrase-import form, phrase-reveal account menu and signature-derived MetaMask login are removed from the web flow.

## Demo

Get started offers a Funder or Operator experience. These identities exist only in memory and only participate in the labelled simulation. They are not written to browser storage and are never substituted into live transactions. Reloading resets the demo.

## Live tools

The app detects injected wallets implementing the public Polkadot/Substrate extension interface. The visitor chooses a wallet, approves account sharing in that extension, then selects one of its shared native accounts. Portion holds its public address and injected signer; the extension retains custody of keys and asks for approval when signing a transaction. Rejected connections/signatures surface as errors, without falling back to a local key or another wallet.

MetaMask's EVM address alone cannot sign Portion's native NFT, asset and storage calls. The former conversion of a message signature into a second spending key is not used by the web app. Existing EVM-specific bridge controls remain separate from native account connection.

No installed compatible wallet is a normal state: the dialog explains it and keeps the working demo available. The browser preview used for QA has no injected wallet. Account sharing, missing/rejected wallet cases, signer routing and rejection handling are unit-tested with mocks; real extension approval and a live transaction have not been verified in that browser. Contracts remain undeployed.

## Existing browser records

The update no longer reads, restores, displays or writes the old `portion.passport.v1` browser record. It deliberately does not delete an existing record: silently removing it could destroy a visitor's only legacy account backup. Legacy locally held keys are not automatically converted into extension accounts. New demo identities and new live connections do not use that record.

SDK mnemonic helpers and deprecated signature-derivation helpers remain for development/legacy compatibility; they are not user sign-in options. Do not expose those helpers as a web form or restore the old secret-persistence flow.

## Dialog behaviour

Account and transaction dialogs trap keyboard focus, support Escape when dismissal is safe, restore previous focus, and lock background scrolling. The demo/native distinction remains visible in account choices and transaction reviews. A native signing rejection is not labelled as a successful payment.

Primary interface references: [Polkadot extension account/signer interface](https://github.com/polkadot-js/extension#api-interface) and [signing through an injected extension](https://polkadot.js.org/docs/extension/usage/).
