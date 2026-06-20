export default function Funnels() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400, textAlign:'center', gap:16 }}>
      <div style={{ width:64, height:64, background:'var(--c-violet-tint)', borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <path d="M4 6h22l-8 10v10l-6-3V16L4 6z" stroke="var(--c-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize:20, fontWeight:800, color:'var(--c-text-primary)', marginBottom:8 }}>Funnels coming soon</div>
        <div style={{ fontSize:14, color:'var(--c-text-muted)', maxWidth:340, lineHeight:1.6 }}>
          Define conversion funnels to see exactly where visitors drop off on their way to a goal.
        </div>
      </div>
      <button style={{ marginTop:4, padding:'10px 22px', border:'1.5px solid var(--c-border-btn)', borderRadius:10, fontSize:13.5, fontWeight:700, color:'var(--c-text-body2)', background:'white', cursor:'pointer' }}>
        Get notified when it ships
      </button>
    </div>
  )
}
