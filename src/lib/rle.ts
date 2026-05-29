export function rleEncode(data: Uint8Array): Uint8Array {
  const result: number[] = []
  let i = 0
  while (i < data.length) {
    const val = data[i]
    let count = 1
    while (i + count < data.length && data[i + count] === val && count < 255) {
      count++
    }
    result.push(count, val)
    i += count
  }
  return new Uint8Array(result)
}

export function rleDecode(data: Uint8Array): Uint8Array {
  // Pre-calculate output length for a single allocation
  let totalLen = 0
  for (let i = 0; i < data.length; i += 2) totalLen += data[i]
  const result = new Uint8Array(totalLen)
  let out = 0
  for (let i = 0; i < data.length; i += 2) {
    const count = data[i]
    const val = data[i + 1]
    result.fill(val, out, out + count)
    out += count
  }
  return result
}
