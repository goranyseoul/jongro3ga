// Append proof: new chart = old chart + exactly one new record in the first empty slot.
// Public: old/new commitments, record_hash = H(new_type, new_date, record_nonce), new_date.
// The procedure type never appears on-chain; the issuing clinic knows the nonce and checks
// record_hash off-chain. new_date is public so the registry contract can check it against
// block.timestamp (no backdating). The old chart stays private.
global N: u32 = 8;

fn commit(types: [Field; N], dates: [u32; N], salt: Field) -> Field {
    let mut inputs: [Field; 2 * N + 1] = [0; 2 * N + 1];
    for i in 0..N {
        inputs[2 * i] = types[i];
        inputs[2 * i + 1] = dates[i] as Field;
    }
    inputs[2 * N] = salt;
    std::hash::pedersen_hash(inputs)
}

fn main(
    old_types: [Field; N],
    old_dates: [u32; N],
    old_salt: Field,
    new_salt: Field,
    slot: u32,
    new_type: Field,
    record_nonce: Field,
    old_commitment: pub Field,
    new_commitment: pub Field,
    record_hash: pub Field,
    new_date: pub u32,
) {
    assert(new_type != 0);
    assert(std::hash::pedersen_hash([new_type, new_date as Field, record_nonce]) == record_hash);
    assert(slot < N);
    if old_commitment == 0 {
        // a subject that is not in the registry yet starts from an EMPTY chart,
        // so nobody can seed a fake history on first registration
        for i in 0..N {
            assert(old_types[i] == 0);
            assert(old_dates[i] == 0);
        }
    } else {
        assert(commit(old_types, old_dates, old_salt) == old_commitment);
    }

    let mut new_types = old_types;
    let mut new_dates = old_dates;
    for i in 0..N {
        if i < slot {
            // slots before the insert point must be filled and not newer than the new record
            assert(old_types[i] != 0);
            assert(old_dates[i] <= new_date);
        } else {
            // insert point and everything after it must be empty
            assert(old_types[i] == 0);
        }
        if i == slot {
            new_types[i] = new_type;
            new_dates[i] = new_date;
        }
    }
    // fresh salt so the new commitment is unlinkable to the old one
    assert(new_salt != old_salt);
    assert(commit(new_types, new_dates, new_salt) == new_commitment);
}

fn rh(t: Field, d: u32) -> Field {
    std::hash::pedersen_hash([t, d as Field, 99])
}

#[test]
fn test_append_ok() {
    let ot = [1, 1, 0, 0, 0, 0, 0, 0];
    let od = [50, 100, 0, 0, 0, 0, 0, 0];
    let oc = commit(ot, od, 11);
    let nc = commit([1, 1, 4, 0, 0, 0, 0, 0], [50, 100, 170, 0, 0, 0, 0, 0], 22);
    main(ot, od, 11, 22, 2, 4, 99, oc, nc, rh(4, 170), 170);
}

#[test(should_fail)]
fn test_append_dropping_old_record_fails() {
    let ot = [1, 2, 0, 0, 0, 0, 0, 0];
    let od = [50, 160, 0, 0, 0, 0, 0, 0];
    let oc = commit(ot, od, 11);
    // user tries to hide the filler (type 2) while appending Thermage
    let nc = commit([1, 4, 0, 0, 0, 0, 0, 0], [50, 170, 0, 0, 0, 0, 0, 0], 22);
    main(ot, od, 11, 22, 2, 4, 99, oc, nc, rh(4, 170), 170);
}

#[test(should_fail)]
fn test_append_overwrite_slot_fails() {
    let ot = [1, 2, 0, 0, 0, 0, 0, 0];
    let od = [50, 160, 0, 0, 0, 0, 0, 0];
    let oc = commit(ot, od, 11);
    let nc = commit([1, 4, 0, 0, 0, 0, 0, 0], [50, 170, 0, 0, 0, 0, 0, 0], 22);
    main(ot, od, 11, 22, 1, 4, 99, oc, nc, rh(4, 170), 170);
}

#[test]
fn test_first_record_from_empty_registry() {
    let ot = [0, 0, 0, 0, 0, 0, 0, 0];
    let od = [0, 0, 0, 0, 0, 0, 0, 0];
    let nc = commit([3, 0, 0, 0, 0, 0, 0, 0], [170, 0, 0, 0, 0, 0, 0, 0], 22);
    main(ot, od, 11, 22, 0, 3, 99, 0, nc, rh(3, 170), 170);
}

#[test(should_fail)]
fn test_seeding_fake_history_fails() {
    // brand-new subject (registry value 0) tries to start with two fake Rejuran records
    let ot = [1, 1, 0, 0, 0, 0, 0, 0];
    let od = [50, 100, 0, 0, 0, 0, 0, 0];
    let nc = commit([1, 1, 3, 0, 0, 0, 0, 0], [50, 100, 170, 0, 0, 0, 0, 0], 22);
    main(ot, od, 11, 22, 2, 3, 99, 0, nc, rh(3, 170), 170);
}
