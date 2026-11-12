// Build against a disposable HTTP fixture, without consulting hosted databases.
const http = require("node:http")
const {spawn} = require("node:child_process")
const root = require("node:path").join(__dirname,"..")
const backend = http.createServer(async (req,res)=>{
  for await(const chunk of req){}
  res.setHeader("Content-Type","application/json")
  res.setHeader("Content-Range","0-0/1")
  const settings={id:1,loyalty_every:6,vehicle_prices:{auto:25000,suv:30000,pickup:35000}}
  res.end(JSON.stringify(req.url.startsWith("/rest/v1/settings")?(req.headers.accept?.includes("vnd.pgrst.object")?settings:[settings]):[]))
})
backend.listen(0,"127.0.0.1",()=>{
  const child=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"build"],{
    cwd:root,stdio:"inherit",env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${backend.address().port}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:"synthetic-anon",SUPABASE_SERVICE_ROLE_KEY:"synthetic-service",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:"synthetic-maps",MK_CARS_RESERVATION_MODE:"demand",NEXT_TELEMETRY_DISABLED:"1",NODE_USE_ENV_PROXY:"1"}
  })
  child.on("exit",code=>{process.exitCode=code??1;backend.close()})
  child.on("error",error=>{console.error(error.message);process.exitCode=1;backend.close()})
})
