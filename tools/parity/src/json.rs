//! Minimal, dependency-free JSON: parse, serialize (deterministic), and a
//! small typed accessor surface. The harness only reads/writes machine-made
//! JSON (fact files, tolerances, corpus analysis), so this implements the
//! JSON data model faithfully without corner-case heroics: full string
//! escapes incl. \uXXXX with surrogate pairs, f64 numbers, and duplicate
//! object keys keep the LAST value (matching serde_json's from_str).

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Value>),
    Obj(Vec<(String, Value)>),
}

impl Value {
    pub fn get(&self, key: &str) -> Option<&Value> {
        match self {
            Value::Obj(pairs) => pairs.iter().rev().find(|(k, _)| k == key).map(|(_, v)| v),
            _ => None,
        }
    }
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }
    pub fn as_arr(&self) -> Option<&[Value]> {
        match self {
            Value::Arr(a) => Some(a),
            _ => None,
        }
    }
    pub fn as_obj(&self) -> Option<&[(String, Value)]> {
        match self {
            Value::Obj(pairs) => Some(pairs),
            _ => None,
        }
    }
    pub fn as_num(&self) -> Option<f64> {
        match self {
            Value::Num(n) => Some(*n),
            _ => None,
        }
    }
}

pub fn parse(text: &str) -> Result<Value, String> {
    let mut p = Parser { bytes: text.as_bytes(), pos: 0 };
    p.skip_ws();
    let v = p.value()?;
    p.skip_ws();
    if p.pos != p.bytes.len() {
        return Err(format!("trailing bytes at offset {}", p.pos));
    }
    Ok(v)
}

struct Parser<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn skip_ws(&mut self) {
        while self.pos < self.bytes.len() && matches!(self.bytes[self.pos], b' ' | b'\t' | b'\n' | b'\r') {
            self.pos += 1;
        }
    }
    fn peek(&self) -> Result<u8, String> {
        self.bytes.get(self.pos).copied().ok_or_else(|| "unexpected end of input".to_string())
    }
    fn expect(&mut self, b: u8) -> Result<(), String> {
        if self.peek()? == b {
            self.pos += 1;
            Ok(())
        } else {
            Err(format!("expected '{}' at offset {}", b as char, self.pos))
        }
    }
    fn value(&mut self) -> Result<Value, String> {
        match self.peek()? {
            b'{' => self.object(),
            b'[' => self.array(),
            b'"' => Ok(Value::Str(self.string()?)),
            b't' => self.lit("true", Value::Bool(true)),
            b'f' => self.lit("false", Value::Bool(false)),
            b'n' => self.lit("null", Value::Null),
            _ => self.number(),
        }
    }
    fn lit(&mut self, word: &str, v: Value) -> Result<Value, String> {
        if self.bytes[self.pos..].starts_with(word.as_bytes()) {
            self.pos += word.len();
            Ok(v)
        } else {
            Err(format!("invalid literal at offset {}", self.pos))
        }
    }
    fn number(&mut self) -> Result<Value, String> {
        let start = self.pos;
        while self.pos < self.bytes.len()
            && matches!(self.bytes[self.pos], b'0'..=b'9' | b'-' | b'+' | b'.' | b'e' | b'E')
        {
            self.pos += 1;
        }
        let s = std::str::from_utf8(&self.bytes[start..self.pos]).map_err(|e| e.to_string())?;
        s.parse::<f64>()
            .map(Value::Num)
            .map_err(|_| format!("invalid number '{}' at offset {}", s, start))
    }
    fn string(&mut self) -> Result<String, String> {
        self.expect(b'"')?;
        let mut out = String::new();
        loop {
            let b = self.peek()?;
            self.pos += 1;
            match b {
                b'"' => return Ok(out),
                b'\\' => {
                    let e = self.peek()?;
                    self.pos += 1;
                    match e {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{0008}'),
                        b'f' => out.push('\u{000C}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => {
                            let hi = self.hex4()?;
                            let ch = if (0xD800..0xDC00).contains(&hi) {
                                // surrogate pair
                                if self.peek()? == b'\\' {
                                    self.pos += 1;
                                    self.expect(b'u')?;
                                    let lo = self.hex4()?;
                                    if (0xDC00..0xE000).contains(&lo) {
                                        let c = 0x10000 + ((hi - 0xD800) << 10) + (lo - 0xDC00);
                                        char::from_u32(c).unwrap_or(char::REPLACEMENT_CHARACTER)
                                    } else {
                                        return Err(format!("bad surrogate pair at offset {}", self.pos));
                                    }
                                } else {
                                    return Err(format!("lone high surrogate at offset {}", self.pos));
                                }
                            } else {
                                char::from_u32(hi).unwrap_or(char::REPLACEMENT_CHARACTER)
                            };
                            out.push(ch);
                        }
                        _ => return Err(format!("bad escape '\\{}' at offset {}", e as char, self.pos)),
                    }
                }
                _ => {
                    // raw byte; rebuild UTF-8 (input is &str so bytes are valid UTF-8 sequences)
                    if b < 0x80 {
                        out.push(b as char);
                    } else {
                        // multi-byte: find sequence length, copy bytes verbatim
                        let len = if b >= 0xF0 { 4 } else if b >= 0xE0 { 3 } else { 2 };
                        let start = self.pos - 1;
                        self.pos += len - 1;
                        if self.pos > self.bytes.len() {
                            return Err("truncated UTF-8 in string".to_string());
                        }
                        out.push_str(
                            std::str::from_utf8(&self.bytes[start..self.pos])
                                .map_err(|e| e.to_string())?,
                        );
                    }
                }
            }
        }
    }
    fn hex4(&mut self) -> Result<u32, String> {
        if self.pos + 4 > self.bytes.len() {
            return Err("truncated \\u escape".to_string());
        }
        let s = std::str::from_utf8(&self.bytes[self.pos..self.pos + 4]).map_err(|e| e.to_string())?;
        let v = u32::from_str_radix(s, 16).map_err(|_| format!("bad \\u escape '{}'", s))?;
        self.pos += 4;
        Ok(v)
    }
    fn object(&mut self) -> Result<Value, String> {
        self.expect(b'{')?;
        let mut pairs = Vec::new();
        self.skip_ws();
        if self.peek()? == b'}' {
            self.pos += 1;
            return Ok(Value::Obj(pairs));
        }
        loop {
            self.skip_ws();
            let key = self.string()?;
            self.skip_ws();
            self.expect(b':')?;
            self.skip_ws();
            let val = self.value()?;
            pairs.push((key, val));
            self.skip_ws();
            match self.peek()? {
                b',' => {
                    self.pos += 1;
                }
                b'}' => {
                    self.pos += 1;
                    return Ok(Value::Obj(pairs));
                }
                b => return Err(format!("expected ',' or '}}', got '{}' at {}", b as char, self.pos)),
            }
        }
    }
    fn array(&mut self) -> Result<Value, String> {
        self.expect(b'[')?;
        let mut items = Vec::new();
        self.skip_ws();
        if self.peek()? == b']' {
            self.pos += 1;
            return Ok(Value::Arr(items));
        }
        loop {
            self.skip_ws();
            items.push(self.value()?);
            self.skip_ws();
            match self.peek()? {
                b',' => {
                    self.pos += 1;
                }
                b']' => {
                    self.pos += 1;
                    return Ok(Value::Arr(items));
                }
                b => return Err(format!("expected ',' or ']', got '{}' at {}", b as char, self.pos)),
            }
        }
    }
}

/// Serialize with 2-space indent and insertion-order keys (deterministic —
/// our model types build objects in sorted order where that matters).
pub fn to_string(v: &Value) -> String {
    let mut out = String::new();
    write_value(v, 0, &mut out);
    out.push('\n');
    out
}

fn write_value(v: &Value, indent: usize, out: &mut String) {
    match v {
        Value::Null => out.push_str("null"),
        Value::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
        Value::Num(n) => {
            if n.fract() == 0.0 && n.abs() < 9.0e15 {
                out.push_str(&format!("{}", *n as i64));
            } else {
                out.push_str(&format!("{}", n));
            }
        }
        Value::Str(s) => write_string(s, out),
        Value::Arr(items) => {
            if items.is_empty() {
                out.push_str("[]");
                return;
            }
            out.push_str("[\n");
            for (i, item) in items.iter().enumerate() {
                out.push_str(&"  ".repeat(indent + 1));
                write_value(item, indent + 1, out);
                if i + 1 < items.len() {
                    out.push(',');
                }
                out.push('\n');
            }
            out.push_str(&"  ".repeat(indent));
            out.push(']');
        }
        Value::Obj(pairs) => {
            if pairs.is_empty() {
                out.push_str("{}");
                return;
            }
            out.push_str("{\n");
            for (i, (k, val)) in pairs.iter().enumerate() {
                out.push_str(&"  ".repeat(indent + 1));
                write_string(k, out);
                out.push_str(": ");
                write_value(val, indent + 1, out);
                if i + 1 < pairs.len() {
                    out.push(',');
                }
                out.push('\n');
            }
            out.push_str(&"  ".repeat(indent));
            out.push('}');
        }
    }
}

fn write_string(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

/// Convenience builders.
pub fn str_arr(items: &[String]) -> Value {
    Value::Arr(items.iter().map(|s| Value::Str(s.clone())).collect())
}
