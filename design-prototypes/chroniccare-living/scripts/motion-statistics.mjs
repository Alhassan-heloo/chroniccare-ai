// Testable definitions shared by the optional production meter and report.
export function percentile(values,p){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  const position=(sorted.length-1)*p,lower=Math.floor(position),upper=Math.ceil(position);
  return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);
}
export function clsMaximum(entries){
  let maximum=0,sum=0,first=-Infinity,last=-Infinity;
  for(const entry of [...entries].sort((a,b)=>a.startTime-b.startTime)){
    if(entry.hadRecentInput)continue;
    if(entry.startTime-last>=1000||entry.startTime-first>=5000){sum=0;first=entry.startTime;}
    sum+=entry.value;last=entry.startTime;maximum=Math.max(maximum,sum);
  }
  return maximum;
}
export const round=(value,digits=3)=>value===null?null:Number(value.toFixed(digits));
export function frameSummary(frames,duration){
  return {frames:frames.length,frameMedianMs:round(percentile(frames,.5)),frameP95Ms:round(percentile(frames,.95)),
    frameGapsOver50ms:frames.filter(value=>value>50).length,
    longFramesPerSecond:round(frames.filter(value=>value>50).length/(duration/1000)),
    frameIntervalsMs:frames.map(value=>round(value))};
}
export function insideWindow(entry,start,end){return entry.startTime>=start&&entry.startTime<end;}
export const comparableSampleDuration=ms=>Number.isFinite(ms)&&ms>=3900&&ms<=6000;
