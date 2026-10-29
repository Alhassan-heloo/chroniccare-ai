export type Language = 'ar' | 'en';
export type Kind = 'pressure' | 'glucose';
export type Theme = 'light' | 'dark';
export type Page = 'home' | 'dashboard';
export interface Reading { id: string; date: string; systolic: number; diastolic: number; glucose: number }
export interface ReadingInput { kind: Kind; systolic: number; diastolic: number; glucose: number }
// The existing project's seven sample values, isolated here; no production imports or writes.
const samples = [[122,78,102],[118,76,96],[124,80,104],[120,78,100],[119,77,98],[122,79,102],[120,80,98]] as const;
export function seedReadings(now = new Date()): Reading[] {
  return samples.map(([systolic,diastolic,glucose],i)=>{const date=new Date(now);date.setDate(date.getDate()-6+i);date.setHours(9,0,0,0);return {id:`sample-${i}`,date:date.toISOString(),systolic,diastolic,glucose};});
}
export function validReading(input: ReadingInput) {
  const positive=(value:number)=>Number.isSafeInteger(value)&&value>0&&value<=9999;
  return input.kind==='pressure'?positive(input.systolic)&&positive(input.diastolic)&&input.diastolic<input.systolic:positive(input.glucose);
}
/** Update only the final demo day's selected series. The seven-day window stays intact. */
export function applyReading(rows: Reading[],input: ReadingInput): Reading[] {
  if(!validReading(input)) return rows;
  return rows.map((row,i)=>i!==rows.length-1?row:{...row,...(input.kind==='pressure'?{systolic:input.systolic,diastolic:input.diastolic}:{glucose:input.glucose})});
}
export function reportSummary(rows: Reading[],period:number) {
  const selected=rows.slice(-period),count=selected.length;
  const average=(key:'systolic'|'glucose')=>count?selected.reduce((sum,row)=>sum+row[key],0)/count:0;
  return {selected,count,systolic:average('systolic'),glucose:average('glucose')};
}
export function createLocale(language: Language) {
  const locale=language==='ar'?'ar-SA-u-nu-latn':'en-US';
  const numbers=new Intl.NumberFormat(locale,{maximumFractionDigits:1});
  const dates=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',calendar:'gregory'});
  const fullDates=new Intl.DateTimeFormat(locale,{weekday:'long',day:'numeric',month:'long',calendar:'gregory'});
  const times=new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hour12:false});
  const plural=new Intl.PluralRules(locale);
  return {n:(value:number)=>numbers.format(value),date:(value:string)=>dates.format(new Date(value)),fullDate:(value:string)=>fullDates.format(new Date(value)),time:(hour:number)=>{const date=new Date();date.setHours(hour,0,0,0);return times.format(date);},
    unit:(kind:'cups'|'steps',count:number)=>language==='en'?(kind==='cups'?(plural.select(count)==='one'?'cup':'cups'):(plural.select(count)==='one'?'step':'steps')):kind==='cups'?(plural.select(count)==='two'?'كوبان':plural.select(count)==='few'?'أكواب':'كوب'):(plural.select(count)==='two'?'خطوتان':plural.select(count)==='few'?'خطوات':'خطوة')};
}
export type Locale = ReturnType<typeof createLocale>;
export function message(value:string,variables:Readonly<Record<string,string|number>>) {return value.replace(/\{\{(\w+)\}\}/g,(placeholder,key:string)=>Object.hasOwn(variables,key)?String(variables[key]):placeholder);}
