# Portion demo video: production record

## Version 2 — 4 November 2026

**Live site changed after the video, 11 November 2026.** The production deploy of `5296300` adds the reviewer's revenue and asset checks. In the sandbox, releasing Riverside's second tranche now also needs the reviewer to verify revenue first (tour 4), so that step no longer goes through exactly as shown at 2:00–2:34.

**Status: uploaded and submitted.** Public link: https://youtu.be/rPeJY-nuwrI (unlisted, 2:56, on the founder's channel). It replaces version 1 below, at the founder's request: same voice, same sandbox section, plus the public Portaldot explorer and a live run of the read-only verifier, so the video shows a working project on chain and not only an interface. The founder listens to it and publishes it.

| | |
| --- | --- |
| File | `demo-output/portion-demo.mp4`, 176.17 s (2:56.2), 1920×1080, H.264/AAC. Version 1 is kept as `demo-output/portion-demo-v1.mp4` |
| Subtitles | [portion-demo.srt](portion-demo.srt), also burned in |
| Recorded from | Commit `8979c11`. Its web bundle, `index-VZDDxsEy.js`, is the same file the live site serves, so the app in the video is the deployed app |
| Capture run | 2026-11-04T06:58:54Z; the verifier ran during it and passed 15 of 15 checks at block 317,043 |
| Voice | Unchanged: Kokoro-82M, `af_heart`, natural speed |

**No new test asset was created.** The deployment wallet holds 44.83 tPOT, and the 40 tPOT reserve stays in place. A new listing cost about 45 tPOT last time, before its buy, deposit and claim, so it would not fit even without the reserve. The video shows listing 585886, which is real, labelled as a disclosed test and sold out. Recording a fresh live listing needs more test tokens from the organisers.

### What changed

| Time | Scene | Change |
| --- | --- | --- |
| 0:13.5–0:30.5 | Problem, listing 585886 | Problem line shortened. The listing scene now says plainly that this is a real asset on the Portaldot testnet, a disclosed test, sold out, and rings the sold-out panel |
| 0:30.6–0:37.8 | Explorer: extrinsic 160,455-1 | New. `revive.instantiateWithCode`, the contract's deployment, in the public explorer |
| 0:37.7–0:48.5 | Explorer: extrinsic 165,551-1 | New. The batch that created the asset: `nfts.mint` (deed NFT), `nfts.setAttribute` (terms hash), `nftFractionalization.fractionalize` (100 native shares of asset 585886) and `revive.call`, labelled with its decoded call, `PortionCore.create(asset 585886)` |
| 0:48.6–1:01.7 | Explorer: extrinsic 165,573-1 | New. The lifecycle batch, with its decoded calls `buy(585886, 100 shares)`, `deposit(585886, 1 pUSD)` and `claim(585886)`, then the signer, to show one account signed both batches |
| 1:01.6–1:12.5 | Terminal | New. The real output of `npm run verify:chain`, run during the recording and replayed line by line. Labelled as output from this recording |
| 1:12.5–2:34.0 | Sandbox | Unchanged |
| 2:34.0–2:45.0 | Business | Shortened to the fee line; the "aim for operators" line was cut for time |
| 2:44.9–2:56.2 | Status card | Says Core v1 is live and verifiable, and visible in the public explorer |

The app's own evidence page was removed from the video, because the explorer shows the same facts from a source Portion does not control.

**Decoded calls.** The labels on the explorer come from decoding each `revive.call` with the contract ABI before recording: block 165,551 call 5 is `create(585886, 100, 100, 604800, 1000000, 1000000, 5000000, 0x7a81ab7e…)`; block 165,573 calls 1, 3, 4 and 5 are `buy(585886, 100)`, `deposit(585886, 1000000)`, `claim(585886)` and `unstake(585886, 100)`.

### Changed narration

- **s2a** Without a shared record, operators track payments by hand, and backers take the numbers on trust.
- **s2b** This is a real asset, listed on the Portaldot testnet as a disclosed test, now sold out. Holders receive only money actually deposited.
- **e1** This is not just an interface. The public Portaldot explorer shows our contract being deployed through Revive.
- **e2** One signed batch created that asset. It minted the deed NFT, stored its terms hash, split it into 100 native shares, and listed it in our Solidity contract.
- **e3** A second batch bought all 100 shares, deposited 1 test pUSD, and claimed 0.995.
- **s3d** One development account played both roles, and none of this verifies physical equipment. (unchanged)
- **v1** Anyone can check this without our app. One command matches the live contract to our source, byte for byte, and recomputes every amount. All 15 checks pass.
- **s6b** Deployed fees are 1% of sales and 0.5% of deposits. That alone won't sustain a business, so a paid operator service is proposed, but unvalidated.
- **s7a** Core v1 is live and verifiable, Core v2 runs locally, and there are no customers yet.

Removed: s3a, s3b and s3c (the evidence-page lines) and s6a. The sentence "can't prove all income was reported" left with s2b; s3d still says none of this verifies physical equipment.

### Quality control

| Check | Result |
| --- | --- |
| Duration | 176.17 s, 3.8 s under the limit |
| Streams and decode | H.264 1920×1080 30 fps, 5,285 frames; AAC 48 kHz stereo; no decode errors |
| Loudness | −16.0 LUFS integrated, peak −4.4 dBFS |
| Speech | Speech recognition on the MP4 heard every line; 91.7% word match, the differences being transcription style ("Portal.testnet", "DED NFT" for "deed NFT") |
| On-screen amounts | All 11 sandbox and listing amounts read from the page during the run, as in version 1 |
| Explorer labels | Each decoded-call label checked in frames to sit on its own row |
| Silences over 2.5 s | Four, at 1:33, 1:42, 2:01 and 2:27, each while a sandbox sheet or result is on screen |

**Not done, because it needs a person:** listening to the whole video and watching it at full speed.

---

## Version 1 — 1 November 2026


**Status: reviewable export. Not uploaded or submitted.** The founder reviews it, confirms pronunciation by ear, and publishes it.

| Deliverable | Location (`demo-output/` is local and ignored by Git) |
| --- | --- |
| Final video, 1920×1080, H.264/AAC | `demo-output/portion-demo.mp4` |
| Subtitles | `demo-output/portion-demo.srt` (also burned in) |
| Voice master, 48 kHz 24-bit WAV | `demo-output/voice/portion-voice-48k-master.wav` |
| Scene-aligned voice segments and durations | `demo-output/voice/segments48k/`, `demo-output/voice/segment-durations.json` |
| Voice samples (three voices) | `demo-output/voice-samples/` |
| Editable scripts, one complete take from one command | `demo-output/build/` (`take.sh`, `capture.mjs`, `beats.py`, `captions.py`, `assemble.py`, `overlays.mjs`, `finish.py`, `qc.py`) |

## Verified requirements

- **Official event:** Portaldot Hacker House 2026, https://dorahacks.io/hackathon/2362/detail, read in a browser on 1 November 2026. Not a Polkadot event.
- **Limit:** "Demo video: no longer than 3 minutes, demonstrates core functions." Final submission and code freeze: 6 November, 04:00 UTC. The Discord was not checked.
- **Licensing rule:** third-party code, assets and data must be properly licensed and attributed.

## Recording version

| | |
| --- | --- |
| Recorded commit | `187a12f` (compiled production build, served locally, reading the production API and the live Portaldot testnet) |
| Production site when recorded | `5579af7`. It has the same features but not the exact sandbox wording or the sandbox release attempt, because a production deploy needs the founder's approval |
| Browser | Chrome 156, automated, 1920×960 picture plus a 120-pixel caption band, light theme, fresh profile |
| Capture run | 2026-11-01T09:10:59.977Z |

**`187a12f` was deployed to production after recording, on 1 November 2026.** The live bundle has the same hashed file name as the recorded build. A browser check on the live site confirmed the sandbox wording, the contract refusing an unapproved release, the evidence label, a connected testnet and no page errors. Any later deploy before submission could make the site differ from the video.

## Claims and evidence

| Claim in the video | Category | Evidence |
| --- | --- | --- |
| Core is deployed on the Portaldot testnet | Live | `/evidence` live check read "Contract found on the connected testnet"; `deployments/portaldot-testnet.json`; block 160,455 |
| Native assets represent shares and test pUSD | Live | Asset 585886; payment asset 4217; `docs/LIVE-TEST-RESULTS.md` |
| A fractionalized NFT links the deed to the share supply | Live | Collection 9, item 438052709; native backing checks |
| Hash-checked terms are stored; a Solidity contract does the accounting | Live | Blocks 165,542 and 165,547; `contracts/src/PortionCore.sol` through Revive |
| 1 test pUSD deposited, 0.995 claimed | Recorded | Block 165,573, hash `0x353098af…`; labelled a recorded transaction on screen |
| One development account played both roles; nothing verifies equipment | Limit | `docs/LIVE-TEST-RESULTS.md`, shown on the evidence page |
| Asset 585886 is sold out | Live | The panel read "Sold out: all 100 shares were bought"; no purchase is attempted |
| 59.7 existing, deposit of 30, 29.85 to holders, 19.9 to Buyer A, 79.6 ready, balance 3,000 to 3,079.6 | Sandbox | Read from the page during the run (table below). 59.7 is named as an existing sandbox allocation, not caused by the new deposit |
| Purchase money stays in escrow; an unapproved release is refused | Sandbox | Core v2 bytecode in a local EVM; real refusal `Protected`; `docs/CORE-V2-CANDIDATE.md` |
| After approval and a simulated one-week window, the release succeeds | Sandbox | 3,000 released, 0 held; the time skip is flagged on screen as simulated |
| On the live contract, purchase money goes straight to the operator | Live | `docs/FUNDING-PROTECTION.md` |
| Deployed fees are 1% of sales and 0.5% of deposits, in test tokens | Live | Read from the contract on `/business` and `/evidence` |
| Those fees would not sustain a business | Reasoned | `docs/FINANCIAL-MODEL.md`, with labelled assumptions |
| A paid operator service is proposed, but unvalidated; no customers yet | Future | `docs/BUSINESS.md`, `docs/INVESTMENT-ASSESSMENT.md` |
| Operators: the aim is less allocation admin and clearer records | Future | Worded as an aim, because no operator has tested it |

Not claimed: audit, verified equipment, legal ownership, customer demand, or that the sandbox runs Portaldot's native pallets. The status card states it runs locally with pretend funds.

## Storyboard, as recorded

Total 174.40s. Timecodes come from the capture log, not from a plan.

| Time | Page and mode | Role | Action | Visible result | Voice |
| --- | --- | --- | --- | --- | --- |
| 0:00.0–0:13.3 | Home, live mode | Visitor | Hover hero, Create an offer, Explore assets; click Explore assets | Hero explains who and what; two product actions | s1a, s1b |
| 0:13.3–0:22.9 | /assets, live | Visitor | Hover asset 585886 | Development test, Sold out, no buy option | s2a |
| 0:22.9–0:33.1 | /listing/585886 #money, live | Visitor | Point at What you might receive, Not checked by Portion | Sold-out panel; plain risk section | s2b |
| 0:33.1–1:01.8 | /evidence, live | Visitor | Point at contract, native asset 4217, NFT collection 9, live check, recorded table, limits | Contract found; fees read from contract; recorded block 165,573 | s3a, s3b, s3c, s3d |
| 1:01.8–1:11.6 | /sandbox | Visitor to Buyer A | Click Start the sandbox; point at disclosure; click My portfolio | Sandbox bar appears and stays | s4a |
| 1:11.6–1:20.9 | /portfolio, sandbox | Buyer A | Ring 59.7; open Riverside | Claimable 59.7; balance 3,000 | s4b |
| 1:20.9–1:29.9 | /listing/100001, sandbox | Operator | Switch role; Review revenue payment; Run in the sandbox; Close | Review: 30 including 0.15 fee, 29.85 to holders; result says sandbox only | s4c |
| 1:29.9–1:49.3 | /portfolio, sandbox | Buyer A | Switch role; ring 79.6; Review claim; Run; Close; ring balance | Claimable 79.6 then 0; balance 3,079.6 | s4d, s4e |
| 1:49.3–2:05.1 | /listing/100001 escrow, sandbox | Operator | Ring 1,500 held; sample evidence; Request the tranche; Run; try to release | Contract refuses: reviewer has not approved | s5a, s5b, s5c |
| 2:05.1–2:23.5 | /listing/100001 escrow, sandbox | Reviewer | Approve; Run; +1 week, +1 day; Release; Run; ring released | Flag: simulated time skip; released 3,000; held 0 | s5d, s5e |
| 2:23.5–2:43.4 | /business, live | Visitor | Point at Job, Customer, fee rows, Why those fees are not enough | Fees read from contract; cost-model limits | s6a, s6b |
| 2:43.4–2:54.4 | Status card | None | Hold | Three categories and both links | s7a, s7b |

## Narration, with measured start and length

Spoken audio totals 147.7s; the remaining 26.7s is space for clicks and results. Words are as captioned.

- **s1a** (0:00.3, 6.42s) Portion helps people who run earning equipment, like solar canopies, share revenue with the people who backed them.
- **s1b** (0:06.9, 5.61s) It records the agreed terms, splits each deposit, and lets each participant claim their part.
- **s2a** (0:13.6, 7.94s) Without a shared record, operators coordinate terms, payments and allocations by hand, and participants take the numbers on trust.
- **s2b** (0:23.2, 9.71s) Portion doesn't create revenue or guarantee returns, and can't prove all income was reported. Participants receive only money actually deposited.
- **s3a** (0:33.4, 3.20s) This is the real deployment, on the Portaldot testnet.
- **s3b** (0:36.8, 12.42s) Native assets represent the shares and test pUSD. A fractionalized NFT links the deed to the share supply. Hash-checked terms are stored, and a Solidity contract does the accounting.
- **s3c** (0:49.5, 6.89s) These recorded transactions show 1 test pUSD deposited, and 0.995 claimed.
- **s3d** (0:56.7, 4.86s) One development account played both roles, and none of this verifies physical equipment.
- **s4a** (1:02.1, 8.13s) To show separate roles, we enter the sandbox: Core v2 in the browser, with fictional roles and pretend funds, not on Portaldot.
- **s4b** (1:11.8, 7.62s) Buyer A already has a sandbox allocation of 59.7, from Riverside Solar Canopy, a fictional asset.
- **s4c** (1:22.0, 6.02s) The operator pays in 30. After a small fee, 29.85 goes to holders.
- **s4d** (1:31.0, 8.02s) Buyer A holds two thirds of the staked shares, so the deposit adds 19.9. 79.6 is now ready.
- **s4e** (1:39.3, 7.70s) Buyer A claims, and the balance rises by exactly that amount. This is deposited money, not a guaranteed return.
- **s5a** (1:50.4, 5.01s) Core v2 adds something the live contract lacks: purchase money stays in escrow.
- **s5b** (1:55.7, 3.33s) The operator requests the next tranche, and tries to release it.
- **s5c** (2:00.6, 3.50s) The contract refuses. The named reviewer has not approved.
- **s5d** (2:06.2, 6.80s) The reviewer approves. After a one-week challenge window, shown as a simulated time skip, the release goes through.
- **s5e** (2:16.9, 6.34s) Core v2 is local and unaudited. On the live contract, purchase money goes straight to the operator.
- **s6a** (2:23.8, 7.70s) For operators, the aim is less allocation admin and clearer records. Participants see deposits and what they can claim.
- **s6b** (2:31.7, 11.44s) Deployed fees are 1% of sales and 0.5% of deposits, in test tokens. That would not sustain a business, so a paid operator service is proposed, but unvalidated.
- **s7a** (2:43.7, 5.87s) Core v1 is live on testnet, Core v2 runs locally, and there are no customers yet.
- **s7b** (2:49.8, 3.22s) Next, we test this with a real operator, in a pilot.

## Amounts asserted on screen during the recorded run

The capture stops if any of these differ.

| Check | Text read from the page |
| --- | --- |
| live sold-out status | Sold out: all 100 shares were bought Every offered share was bought. This offer cannot take another purchase. No market exists for these shares. Trading would n |
| live contract check | Contract found on the connected testnet · fees read from contract: 1% on sales, 0.5% on deposits |
| claimable before | Income ready to claim 59.7 pUSD Review claim ↗ |
| balance before | Sandbox balance 3,000 pUSD Pretend money · no value |
| deposit review result | Deposit revenue into Riverside Solar Canopy (fictional) Done in the sandbox only. Nothing happened on Portaldot. WHAT CHANGED Your deposit was split among the s |
| claimable after deposit | Income ready to claim 79.6 pUSD Review claim ↗ |
| balance after claim | Sandbox balance 3,079.6 pUSD Pretend money · no value |
| claimable after claim | Income ready to claim 0 pUSD Deposited income appears here |
| escrow before | Still held by the contract 1,500 pUSD |
| refusal | This action can’t go ahead Nothing was sent. The contract refused the release: the named reviewer has not approved this tranche. (contract error: Protected) Wha |
| release result | Release the tranche Done in the sandbox only. Nothing happened on Portaldot. WHAT CHANGED The tranche was paid to the operator, less the 1% fee. Simulated recor |
| escrow after | Released to the operator 3,000 pUSD |

## Voice and pronunciation

- **Voice:** Kokoro-82M, voice `af_heart` (adult female, American English), at its natural speed, generated locally. Free, with no account or subscription.
- **Licence:** model weights Apache-2.0; `kokoro-onnx` runtime MIT. macOS voices were not used, because their licence appears to limit them to personal, non-commercial use.
- **Attribution for the submission:** "Narration generated with Kokoro-82M (Apache-2.0)."
- **Not done:** the founder has not confirmed the pronunciations by ear.

| Term | Intended | Phonemes generated |
| --- | --- | --- |
| Portion | POR-shun | pˈɔːɹʃən |
| Portaldot | POR-tal-dot. Polkadot is never said | pˈɔːɹɾɐldˌɑːt |
| pUSD | "test P-U-S-D" | pˈiːjˈuːˈɛsdˈiː |
| Buyer A | "Buyer ay"; written `Buyer "A"` after a first version read as "Buyer uh" | bˈaɪɚ ˈeɪ |
| escrow | ES-kro | ˈɛskɹoʊ |
| Core v2 | "core vee two" | kˈɔːɹ vˈiː tˈuː |

## Quality-control report, final export

| Check | Result |
| --- | --- |
| Duration, including first and last frames | **174.40 s (2:54.4)**, 5.6 s under the limit |
| Streams | H.264 1920×1080 30 fps, 5,232 frames; AAC 48 kHz stereo; both 174.40 s |
| Full decode | No errors |
| Loudness | −16.0 LUFS integrated; true peak −4.2 dBTP in the MP4, −1.5 dBTP in the master; no music |
| Audio present and correct | Speech recognition run on the MP4 alone heard every line, including 0.995, 59.7, 29.85, 19.9 and 79.6; 92% word match. Its differences are transcription style, such as "portal.testnet" for "Portaldot testnet" |
| Silent stretches over 2.5 s | Four, at 1:22, 1:31, 1:50 and 2:17, each while a sheet or result is on screen |
| On-screen amounts | 12 of 12 read from the page during the recorded run |
| Muted understanding | Frames stepped through about every 2–3 s across the sandbox journey: roles, amounts, refusal and result are readable with captions |
| Reduced size | Contact sheet at 320 pixels wide: captions and main amounts still legible |
| Disclosures | Sandbox bar and evidence label present in every sandbox frame sampled; recorded-transaction label on historical evidence |

**Not done, because it needs a person:** listening to the whole video, and watching it continuously at full speed. An automated check cannot judge how natural the voice sounds or whether the pacing feels right. No first-time viewer has tested it, so comprehension is unproven.

**Deviations from the brief:**
- Narration is 364 words, above the 300–325 aim. The measured runtime still fits, with about 27 seconds of space for clicks and results.
- Key amounts use highlight rings rather than zooms, so the picture stays sharp and the sandbox bar is never cropped.

## Remaining submission risks

- **Testnet node:** the public node has been intermittent, so a judge may briefly see the "not answering" screen. Asset 585886 shows Late now and will show Defaulted after 6 November, because no deposit is scheduled; the video shows its state on the recording date.
- **Still needed:** a public upload of the video, and the DoraHacks fields only the founder can complete. See the [proposed entry text](DORAHACKS-ENTRY.md).
