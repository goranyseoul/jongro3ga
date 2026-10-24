// Record hash the issuing clinic recomputes to confirm its record was appended (same as append circuit)
fn main(new_type: Field, new_clinic: Field, new_date: u32, record_nonce: Field) -> pub Field {
    std::hash::pedersen_hash([new_type, new_clinic, new_date as Field, record_nonce])
}
