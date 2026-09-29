//! Round-trip fuzz for the hand-rolled JSON codec (#162 consult: the parser
//! is the risk center — bound it to our own fact-file grammar and fuzz it).
//! Deterministic LCG, no external crates, integers only (exact equality).

#[allow(dead_code)]
#[path = "../src/json.rs"]
mod json;

use json::Value;

struct Lcg(u64);
impl Lcg {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.0 >> 33
    }
}

fn random_value(rng: &mut Lcg, depth: u8) -> Value {
    match rng.next() % (if depth == 0 { 4 } else { 7 }) {
        0 => Value::Null,
        1 => Value::Bool(rng.next() % 2 == 0),
        2 => Value::Num((rng.next() % 2000) as f64 - 1000.0), // integers: exact round-trip
        3 => {
            // strings with the awkward characters: quotes, backslash,
            // controls, unicode incl. astral plane (surrogate pair encoding)
            let pool = [
                "", "a", "quo\"te", "back\\slash", "new\nline\ttab", "ctrl\u{0001}",
                "émoji 🦀 café", "Find loops…", "\u{1F980}", "loop/:loopId/run",
                "Loops are available on Business and Enterprise plans",
            ];
            Value::Str(pool[(rng.next() as usize) % pool.len()].to_string())
        }
        4 => {
            let n = rng.next() % 5;
            Value::Arr((0..n).map(|_| random_value(rng, depth - 1)).collect())
        }
        5 => {
            let n = rng.next() % 5;
            Value::Obj(
                (0..n)
                    .map(|i| (format!("k{}", i), random_value(rng, depth - 1)))
                    .collect(),
            )
        }
        _ => {
            let n = rng.next() % 3;
            Value::Obj(
                (0..n)
                    .map(|_| (format!("key\u{00e9}{}", rng.next() % 100), random_value(rng, depth - 1)))
                    .collect(),
            )
        }
    }
}

#[test]
fn json_roundtrip_fuzz() {
    let mut rng = Lcg(0x5EED_5EED_5EED_5EED);
    for i in 0..2000 {
        let v = random_value(&mut rng, 4);
        let text = json::to_string(&v);
        let back = json::parse(&text).unwrap_or_else(|e| panic!("parse failed at iter {}: {}\ninput: {}", i, e, text));
        assert_eq!(back, v, "round-trip mismatch at iter {}", i);
    }
}

#[test]
fn json_rejects_garbage() {
    for bad in ["{", "[1,", "{\"a\":}", "tru", "\"unterminated", "{\"a\":1,}"] {
        assert!(json::parse(bad).is_err(), "must reject: {}", bad);
    }
}
