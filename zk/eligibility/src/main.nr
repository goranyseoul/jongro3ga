// Condition proof over a private procedure chart. Each record = (procedure type, day, clinic).
// Proves: min_count <= #{ i : record i is non-empty,
//                             (target_type == 0 or types[i] == target_type),
//                             (target_clinic == 0 or clinics[i] == target_clinic),
//                             min_days <= today - dates[i] <= max_days } <= max_count
// Examples: "Juvelook exactly once, none in the last 27 days" (2nd-session offer),
//           "no record at clinic X" (first-visit offer), "no filler within 14 days" (safety).
// The chart stays private; it must hash to the commitment anchored on-chain.
global N: u32 = 8;

fn commit(types: [Field; N], dates: [u32; N], clinics: [Field; N], salt: Field) -> Field {
    let mut inputs: [Field; 3 * N + 1] = [0; 3 * N + 1];
    for i in 0..N {
        inputs[3 * i] = types[i];
        inputs[3 * i + 1] = dates[i] as Field;
        inputs[3 * i + 2] = clinics[i];
    }
    inputs[3 * N] = salt;
    std::hash::pedersen_hash(inputs)
}

fn count_matches(
    types: [Field; N],
    dates: [u32; N],
    clinics: [Field; N],
    today: u32,
    target_type: Field,
    target_clinic: Field,
    min_days: u32,
    max_days: u32,
) -> u32 {
    let mut count: u32 = 0;
    for i in 0..N {
        // u64 so that date + max_days cannot overflow
        let d = dates[i] as u64;
        let t = today as u64;
        let in_window = (d + min_days as u64 <= t) & (t <= d + max_days as u64);
        let type_ok = (target_type == 0) | (types[i] == target_type);
        let clinic_ok = (target_clinic == 0) | (clinics[i] == target_clinic);
        // type 0 marks an empty slot
        if (types[i] != 0) & type_ok & clinic_ok & in_window {
            count += 1;
        }
    }
    count
}

fn main(
    types: [Field; N],
    dates: [u32; N],
    clinics: [Field; N],
    salt: Field,
    commitment: pub Field,
    today: pub u32,
    target_type: pub Field,
    target_clinic: pub Field,
    min_days: pub u32,
    max_days: pub u32,
    min_count: pub u32,
    max_count: pub u32,
) {
    assert(commit(types, dates, clinics, salt) == commitment);
    let count = count_matches(types, dates, clinics, today, target_type, target_clinic, min_days, max_days);
    assert(min_count <= count);
    assert(count <= max_count);
}

// Test codes: types 1 = Juvelook, 2 = filler, 3 = Rejuran; clinics 10 = Hongdae A, 20 = Yeoksam I, 30 = Sinnonhyeon D
global FOREVER: u32 = 100000;

#[test]
fn test_second_session_offer() {
    // Juvelook once at Hongdae A, 30 days ago
    let (t, d, c) = ([1, 0, 0, 0, 0, 0, 0, 0], [140, 0, 0, 0, 0, 0, 0, 0], [10, 0, 0, 0, 0, 0, 0, 0]);
    let cm = commit(t, d, c, 42);
    main(t, d, c, 42, cm, 170, 1, 0, 0, FOREVER, 1, 1); // exactly one Juvelook, ever
    main(t, d, c, 42, cm, 170, 1, 0, 0, 27, 0, 0); // none in the last 27 days
}

#[test(should_fail)]
fn test_second_session_too_early() {
    let (t, d, c) = ([1, 0, 0, 0, 0, 0, 0, 0], [160, 0, 0, 0, 0, 0, 0, 0], [10, 0, 0, 0, 0, 0, 0, 0]);
    let cm = commit(t, d, c, 42);
    main(t, d, c, 42, cm, 170, 1, 0, 0, 27, 0, 0);
}

#[test]
fn test_first_visit_at_clinic() {
    // Rejuran at Sinnonhyeon D; never been to Yeoksam I
    let (t, d, c) = ([3, 3, 0, 0, 0, 0, 0, 0], [100, 150, 0, 0, 0, 0, 0, 0], [30, 30, 0, 0, 0, 0, 0, 0]);
    let cm = commit(t, d, c, 7);
    main(t, d, c, 7, cm, 170, 0, 20, 0, FOREVER, 0, 0);
}

#[test(should_fail)]
fn test_first_visit_fails_after_visiting() {
    let (t, d, c) = ([3, 3, 0, 0, 0, 0, 0, 0], [100, 150, 0, 0, 0, 0, 0, 0], [30, 20, 0, 0, 0, 0, 0, 0]);
    let cm = commit(t, d, c, 7);
    main(t, d, c, 7, cm, 170, 0, 20, 0, FOREVER, 0, 0);
}

#[test]
fn test_absence_no_filler_14d() {
    let (t, d, c) = ([3, 2, 0, 0, 0, 0, 0, 0], [100, 150, 0, 0, 0, 0, 0, 0], [30, 10, 0, 0, 0, 0, 0, 0]);
    let cm = commit(t, d, c, 42);
    main(t, d, c, 42, cm, 170, 2, 0, 0, 14, 0, 0);
}

#[test(should_fail)]
fn test_tampered_record_fails() {
    let cm = commit([3, 2, 0, 0, 0, 0, 0, 0], [100, 160, 0, 0, 0, 0, 0, 0], [30, 10, 0, 0, 0, 0, 0, 0], 42);
    // Dropping the filler record breaks the commitment match
    main([3, 0, 0, 0, 0, 0, 0, 0], [100, 0, 0, 0, 0, 0, 0, 0], [30, 0, 0, 0, 0, 0, 0, 0], 42, cm, 170, 2, 0, 0, 14, 0, 0);
}

#[test(should_fail)]
fn test_empty_slots_never_count() {
    // "any procedure, any clinic, at least 3" must not count the 6 empty slots
    let (t, d, c) = ([3, 3, 0, 0, 0, 0, 0, 0], [100, 150, 0, 0, 0, 0, 0, 0], [30, 30, 0, 0, 0, 0, 0, 0]);
    let cm = commit(t, d, c, 7);
    main(t, d, c, 7, cm, 170, 0, 0, 0, FOREVER, 3, N);
}
