// Commitment that clinics/platform post to the registry (same hash as eligibility)
global N: u32 = 8;

fn main(types: [Field; N], dates: [u32; N], salt: Field) -> pub Field {
    let mut inputs: [Field; 2 * N + 1] = [0; 2 * N + 1];
    for i in 0..N {
        inputs[2 * i] = types[i];
        inputs[2 * i + 1] = dates[i] as Field;
    }
    inputs[2 * N] = salt;
    std::hash::pedersen_hash(inputs)
}
