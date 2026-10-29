/** Small pure geometry rule shared by the focus guard and its regression tests. */
export function focusScrollDelta(top:number,bottom:number,safeTop:number,safeBottom:number) {
  if(top<safeTop)return top-safeTop;
  if(bottom>safeBottom)return bottom-top>safeBottom-safeTop?top-safeTop:bottom-safeBottom;
  return 0;
}
