// Chart commitment (same hash as eligibility/append): records (type, day, clinic) + salt
global N: u32 = 8;

fn main(types: [Field; N], dates: [u32; N], clinics: [Field; N], salt: Field) -> pub Field {
    let mut inputs: [Field; 3 * N + 1] = [0; 3 * N + 1];
    for i in 0..N {
        inputs[3 * i] = types[i];
        inputs[3 * i + 1] = dates[i] as Field;
        inputs[3 * i + 2] = clinics[i];
    }
    inputs[3 * N] = salt;
    std::hash::pedersen_hash(inputs)
}
