import {useEffect,useState} from "react";
let pendingId:string|null=null;
const event="chroniccare:reading-saved";
export function announceSavedReading(id:string){pendingId=id;window.dispatchEvent(new Event(event));}
function consume(){const id=pendingId;pendingId=null;return id;}
export function useSavedReading(){
 const [id,setId]=useState(consume);
 useEffect(()=>{const update=()=>setId(consume());window.addEventListener(event,update);return()=>window.removeEventListener(event,update);},[]);
 return id;
}
