const sharp = require("./node_modules/.pnpm/sharp@0.35.5_@types+node@26.6.4/node_modules/sharp")
;(async () => {
  const src = "/tmp/icons-bak/auto.png"
  const { width, height } = await sharp(src).metadata()
  const W = width * 2
  const H = height * 2
  const alpha = await sharp(src)
    .extractChannel("alpha")
    .resize(W, H, { kernel: "lanczos3" })
    .blur(3.2)
    .threshold(225)
    .blur(0.8)
    .toColourspace("b-w")
    .raw()
    .toBuffer()
  const base = await sharp({ create: { width: W, height: H, channels: 3, background: "#ffffff" } }).png().toBuffer()
  const out = await sharp(base).joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer()
  await sharp(out).flop().png().toFile("public/images/icons/auto.png")
  console.log("ok", W, H)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
