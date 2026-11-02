import { readFile } from "node:fs/promises";
import { createPrivateKey, sign } from "node:crypto";
import type { PushProvider, PushResult } from "./push.js";

// Official FCM HTTP v1 + service-account OAuth JWT grant. No client/server SDK credentials cross the boundary.
export async function configuredPush(env: NodeJS.ProcessEnv = process.env, transport: typeof fetch = fetch): Promise<PushProvider | undefined> {
  if (env.FCM_ENABLED !== "true") return undefined;
  const project=env.FCM_PROJECT_ID;
  if (!project || !/^[a-z0-9-]{6,63}$/.test(project) || !env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("Push configuration is incomplete.");
  const credentials=JSON.parse(await readFile(env.GOOGLE_APPLICATION_CREDENTIALS,"utf8")) as Record<string,unknown>;
  if (credentials.type!=="service_account" || typeof credentials.client_email!=="string" || typeof credentials.private_key!=="string") throw new Error("Invalid server push credentials.");
  const key=createPrivateKey(credentials.private_key), email=credentials.client_email;
  let cached: {token:string; expires:number} | undefined;
  async function accessToken() {
    if (cached && cached.expires>Date.now()+60000) return cached.token;
    const now=Math.floor(Date.now()/1000), encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
    const value=encode({alg:"RS256",typ:"JWT"})+"."+encode({iss:email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
    const assertion=value+"."+sign("RSA-SHA256",Buffer.from(value),key).toString("base64url");
    const response=await transport("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error("Push authorization unavailable.");
    const data=await response.json() as {access_token?:unknown;expires_in?:unknown};
    if (typeof data.access_token!=="string" || typeof data.expires_in!=="number") throw new Error("Invalid push authorization response.");
    cached={token:data.access_token,expires:Date.now()+Math.min(data.expires_in,3600)*1000}; return cached.token;
  }
  return { async send(fid,id):Promise<PushResult> {
    try {
      const token=await accessToken();
      const response=await transport(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`,{
        method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(10000),
        body:JSON.stringify({message:{fid,data:{deliveryId:id},webpush:{headers:{TTL:"60",Urgency:"normal"}}}}),
      });
      if (response.ok) return "sent";
      const data=await response.json().catch(()=>null) as {error?:{details?:{errorCode?:string}[]}} | null;
      if (data?.error?.details?.some(item=>item.errorCode==="UNREGISTERED")) return "invalid";
      if (response.status===401) cached=undefined;
      return response.status===429 || response.status>=500 || response.status===401 ? "retry" : "permanent";
    } catch { return "retry"; }
  } };
}
