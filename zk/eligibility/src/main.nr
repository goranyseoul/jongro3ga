// Condition proof over a private procedure chart.
// Proves: min_count <= #{ i : types[i] == target_type and min_days <= today - dates[i] <= max_days } <= max_count
// Covers presence ("Rejuran >= 2 times, last one 60+ days ago") and absence ("no filler within 14 days").
// The chart (types, dates, salt) stays private; it must hash to the registry commitment.
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

fn count_matches(
    types: [Field; N],
    dates: [u32; N],
    today: u32,
    target_type: Field,
    min_days: u32,
    max_days: u32,
) -> u32 {
    let mut count: u32 = 0;
    for i in 0..N {
        // u64 so that date + max_days cannot overflow
        let d = dates[i] as u64;
        let t = today as u64;
        let in_window = (d + min_days as u64 <= t) & (t <= d + max_days as u64);
        if (types[i] == target_type) & in_window {
            count += 1;
        }
    }
    count
}

fn main(
    types: [Field; N],
    dates: [u32; N],
    salt: Field,
    commitment: pub Field,
    today: pub u32,
    target_type: pub Field,
    min_days: pub u32,
    max_days: pub u32,
    min_count: pub u32,
    max_count: pub u32,
) {
    // type 0 marks an empty slot and must never be a target
    assert(target_type != 0);
    assert(commit(types, dates, salt) == commitment);
    let count = count_matches(types, dates, today, target_type, min_days, max_days);
    assert(min_count <= count);
    assert(count <= max_count);
}

// Procedure codes used in tests: 1 = Rejuran, 2 = filler, 4 = Thermage
global FOREVER: u32 = 100000;

#[test]
fn test_presence_rejuran_twice_60d() {
    let types = [1, 1, 2, 0, 0, 0, 0, 0];
    let dates = [50, 100, 160, 0, 0, 0, 0, 0];
    let c = commit(types, dates, 42);
    main(types, dates, 42, c, 170, 1, 60, FOREVER, 2, N);
}

#[test(should_fail)]
fn test_presence_fails_when_too_recent() {
    // second Rejuran only 20 days ago -> only 1 match with min_days = 60
    let types = [1, 1, 0, 0, 0, 0, 0, 0];
    let dates = [50, 150, 0, 0, 0, 0, 0, 0];
    let c = commit(types, dates, 42);
    main(types, dates, 42, c, 170, 1, 60, FOREVER, 2, N);
}

#[test]
fn test_presence_thermage_ever() {
    let types = [4, 0, 0, 0, 0, 0, 0, 0];
    let dates = [10, 0, 0, 0, 0, 0, 0, 0];
    let c = commit(types, dates, 7);
    main(types, dates, 7, c, 170, 4, 0, FOREVER, 1, N);
}

#[test]
fn test_absence_no_filler_14d() {
    let types = [1, 2, 0, 0, 0, 0, 0, 0];
    let dates = [100, 150, 0, 0, 0, 0, 0, 0];
    let c = commit(types, dates, 42);
    main(types, dates, 42, c, 170, 2, 0, 14, 0, 0);
}

#[test(should_fail)]
fn test_absence_fails_with_recent_filler() {
    let types = [1, 2, 0, 0, 0, 0, 0, 0];
    let dates = [100, 160, 0, 0, 0, 0, 0, 0];
    let c = commit(types, dates, 42);
    main(types, dates, 42, c, 170, 2, 0, 14, 0, 0);
}

#[test(should_fail)]
fn test_tampered_record_fails() {
    let c = commit([1, 2, 0, 0, 0, 0, 0, 0], [100, 160, 0, 0, 0, 0, 0, 0], 42);
    // Dropping the filler record breaks the commitment match
    main([1, 0, 0, 0, 0, 0, 0, 0], [100, 0, 0, 0, 0, 0, 0, 0], 42, c, 170, 2, 0, 14, 0, 0);
}

#[test(should_fail)]
fn test_empty_slot_target_rejected() {
    let types = [1, 0, 0, 0, 0, 0, 0, 0];
    let dates = [100, 0, 0, 0, 0, 0, 0, 0];
    let c = commit(types, dates, 42);
    main(types, dates, 42, c, 170, 0, 0, FOREVER, 1, N);
}
