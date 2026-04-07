const dir = import.meta.dir

let tls: { key: string; cert: string } | undefined
try {
  const key = await Bun.file(`${dir}/key.pem`).text()
  const cert = await Bun.file(`${dir}/cert.pem`).text()
  tls = { key, cert }
} catch {
  tls = undefined
}

export { tls }
