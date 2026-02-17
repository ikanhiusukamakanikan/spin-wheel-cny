import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const TOTAL = 50;
const ALL_NUMS: number[] = Array.from({ length: TOTAL }, (_, i) => i + 1);

// ─── Types ───────────────────────────────────────────────────────────────────
interface ConfettiParticleProps { x:number; color:string; delay:number; size:number; shape:"circle"|"square"|"rect"; }
interface ConfettiParticleData extends ConfettiParticleProps { id:number; }
type RevealPhase = "idle"|"flash"|"zoom"|"rise"|"show";
type View = "wheel"|"admin";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shuffle(arr: number[]): number[] {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

const SEG_COLORS = ["#C41E1E","#D4AF37","#8B0000","#FFD700","#B22222","#DAA520","#DC143C","#F0C040"];
const segColor = (i:number) => SEG_COLORS[i % SEG_COLORS.length];
const lighten = (hex:string, amt:number) => {
  const n = parseInt(hex.replace("#",""),16);
  return `rgb(${Math.min(255,(n>>16)+amt)},${Math.min(255,((n>>8)&0xff)+amt)},${Math.min(255,(n&0xff)+amt)})`;
};

// ─── Canvas draw ─────────────────────────────────────────────────────────────
function drawWheel(canvas: HTMLCanvasElement|null, numbers: number[], rotation: number): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const W=canvas.width, H=canvas.height, cx=W/2, cy=H/2;
  const R=W/2-6, count=numbers.length, arc=(2*Math.PI)/count;
  ctx.clearRect(0,0,W,H);

  // outer glow
  const glow = ctx.createRadialGradient(cx,cy,R*0.7,cx,cy,R+8);
  glow.addColorStop(0,"rgba(212,175,55,0)"); glow.addColorStop(1,"rgba(212,175,55,0.4)");
  ctx.beginPath(); ctx.arc(cx,cy,R+4,0,2*Math.PI); ctx.fillStyle=glow; ctx.fill();

  numbers.forEach((num,i) => {
    const sa=rotation+i*arc, ea=sa+arc, ma=sa+arc/2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,sa,ea); ctx.closePath();
    const g=ctx.createRadialGradient(cx,cy,R*0.2,cx,cy,R);
    const base=segColor(i); g.addColorStop(0,lighten(base,30)); g.addColorStop(1,base);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle="rgba(212,175,55,0.6)"; ctx.lineWidth=1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,R*0.55,sa,ea);
    ctx.strokeStyle="rgba(255,215,0,0.2)"; ctx.lineWidth=1; ctx.stroke();
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(ma);
    ctx.textAlign="right"; ctx.textBaseline="middle";
    ctx.shadowColor="rgba(0,0,0,0.6)"; ctx.shadowBlur=3;
    const fs=count<=20?14:count<=35?11:9;
    ctx.font=`bold ${fs}px 'Noto Serif SC',serif`;
    ctx.fillStyle="#FFD700"; ctx.fillText(num.toString(),R*0.87,0); ctx.restore();
  });

  // coin
  const coinR=R*0.12;
  ctx.beginPath(); ctx.arc(cx,cy,coinR+5,0,2*Math.PI); ctx.fillStyle="#4A2E00"; ctx.fill();
  const cg=ctx.createRadialGradient(cx-coinR*0.3,cy-coinR*0.3,1,cx,cy,coinR);
  cg.addColorStop(0,"#FFF8DC"); cg.addColorStop(0.35,"#FFD700"); cg.addColorStop(0.75,"#DAA520"); cg.addColorStop(1,"#9B6914");
  ctx.beginPath(); ctx.arc(cx,cy,coinR,0,2*Math.PI); ctx.fillStyle=cg; ctx.fill();
  ctx.beginPath(); ctx.arc(cx,cy,coinR*0.72,0,2*Math.PI); ctx.strokeStyle="#7A5010"; ctx.lineWidth=1.5; ctx.stroke();
  const sq=coinR*0.3;
  ctx.fillStyle="#2A0E00"; ctx.fillRect(cx-sq,cy-sq,sq*2,sq*2);
  ctx.strokeStyle="#5A3800"; ctx.lineWidth=1; ctx.strokeRect(cx-sq,cy-sq,sq*2,sq*2);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function ConfettiParticle({x,color,delay,size,shape}:ConfettiParticleProps) {
  return <div style={{
    position:"absolute",left:`${x}%`,top:"-20px",
    width:shape==="rect"?`${size*2}px`:`${size}px`, height:`${size}px`,
    backgroundColor:color, borderRadius:shape==="circle"?"50%":"2px",
    animation:`confettiFall ${2.2+Math.random()*2}s ${delay}s cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
    transform:`rotate(${Math.random()*360}deg)`,
  }}/>;
}
function ConfettiExplosion() {
  const colors=["#FFD700","#FF4444","#FF9900","#FFFFFF","#C41E1E","#DAA520","#FF6B6B","#FFF8DC"];
  const shapes:Array<"circle"|"square"|"rect">=["circle","square","rect"];
  const pts:ConfettiParticleData[]=Array.from({length:100},(_,i)=>({
    id:i, x:Math.random()*100, color:colors[Math.floor(Math.random()*colors.length)],
    delay:Math.random()*1.0, size:6+Math.floor(Math.random()*8),
    shape:shapes[Math.floor(Math.random()*shapes.length)],
  }));
  return <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:100}}>
    {pts.map(p=><ConfettiParticle key={p.id} x={p.x} color={p.color} delay={p.delay} size={p.size} shape={p.shape}/>)}
  </div>;
}

// ─── Reveal Overlay ──────────────────────────────────────────────────────────
function RevealOverlay({winner,phase,onNext}:{winner:number;phase:RevealPhase;onNext:()=>void}) {
  useEffect(()=>{
    if(phase==="idle"||phase==="show") return;
    const d:Record<string,number>={flash:420,zoom:580,rise:680};
    const t=setTimeout(onNext,d[phase]??500);
    return ()=>clearTimeout(t);
  },[phase,onNext]);
  if(phase==="idle") return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:90,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:phase==="show"?"auto":"none"}}>
      {phase==="flash"&&<div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 50%,rgba(255,230,50,0.98) 0%,rgba(255,120,0,0.8) 30%,rgba(139,0,0,0.6) 55%,transparent 78%)",animation:"revealFlash 0.42s ease-out forwards"}}/>}
      {phase==="zoom"&&(
        <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at center,rgba(100,0,0,0.92) 0%,rgba(0,0,0,0.78) 100%)",animation:"fadeIn 0.15s ease-out forwards"}}>
          <div style={{position:"absolute",top:"50%",left:"50%",fontFamily:"'Cinzel Decorative',serif",fontWeight:900,lineHeight:1,fontSize:"clamp(9rem,35vw,22rem)",color:"transparent",WebkitTextStroke:"clamp(1px,0.3vw,3px) rgba(255,215,0,0.5)",animation:"numberZoomIn 0.58s cubic-bezier(0.22,1.4,0.36,1) forwards"}}>{winner}</div>
        </div>
      )}
      {phase==="rise"&&(
        <div style={{position:"absolute",inset:0,background:"radial-gradient(circle at 50% 60%,rgba(120,0,0,0.93) 0%,rgba(0,0,0,0.88) 100%)"}}>
          <div style={{position:"absolute",top:"50%",left:"50%",width:"clamp(120px,40vw,300px)",height:"clamp(120px,40vw,300px)",transform:"translate(-50%,-50%)",borderRadius:"50%",border:"2px solid rgba(255,215,0,0.6)",animation:"shockwaveRing 0.68s ease-out forwards"}}/>
          <div style={{position:"absolute",top:"50%",left:"50%",textAlign:"center",animation:"riseUp 0.68s cubic-bezier(0.34,1.4,0.64,1) forwards"}}>
            <div style={{fontFamily:"'Cinzel Decorative',serif",fontWeight:900,lineHeight:1,fontSize:"clamp(5.5rem,22vw,15rem)",background:"linear-gradient(180deg,#FFF8DC 0%,#FFD700 40%,#B8860B 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",filter:"drop-shadow(0 0 30px rgba(255,215,0,0.95)) drop-shadow(0 0 60px rgba(255,140,0,0.6))"}}>{winner}</div>
            <div style={{color:"rgba(255,215,0,0.85)",letterSpacing:"0.45em",fontSize:"clamp(0.75rem,2.5vw,1.3rem)",marginTop:"8px",animation:"fadeIn 0.35s 0.25s ease-out both"}}>✦ LUCKY NUMBER ✦</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────
function HistoryPanel({history,remaining}:{history:number[];remaining:number}) {
  return (
    <div style={{background:"rgba(0,0,0,0.45)",border:"1px solid rgba(212,175,55,0.28)",borderRadius:"14px",padding:"14px",backdropFilter:"blur(12px)",maxHeight:"clamp(200px,44vh,500px)",display:"flex",flexDirection:"column"}}>
      <div style={{color:"#FFD700",fontWeight:700,fontSize:"clamp(0.62rem,1.6vw,0.8rem)",letterSpacing:"0.18em",textAlign:"center",marginBottom:"7px",borderBottom:"1px solid rgba(212,175,55,0.22)",paddingBottom:"8px"}}>📜 DRAWN</div>
      <div style={{color:"rgba(212,175,55,0.42)",fontSize:"0.67rem",textAlign:"center",marginBottom:"7px"}}>{history.length} drawn · {remaining} left</div>
      <div style={{overflowY:"auto",flex:1,display:"flex",flexWrap:"wrap",gap:"5px",alignContent:"flex-start"}}>
        {history.length===0
          ? <div style={{color:"rgba(255,255,255,0.18)",fontSize:"0.72rem",width:"100%",textAlign:"center",marginTop:"14px"}}>No numbers yet</div>
          : history.map((n,i)=>(
            <div key={`h-${n}-${i}`} style={{
              background:i===0?"linear-gradient(135deg,#8B0000,#C41E1E)":"rgba(212,175,55,0.07)",
              border:`1px solid ${i===0?"#FFD700":"rgba(212,175,55,0.17)"}`,
              borderRadius:"7px",padding:"3px 7px",
              color:i===0?"#FFD700":"rgba(255,255,255,0.58)",
              fontSize:"0.77rem",fontWeight:i===0?700:400,
              minWidth:"30px",textAlign:"center",
              animation:i===0?"badgeIn 0.4s cubic-bezier(0.34,1.56,0.64,1)":"none",
            }}>{n}</div>
          ))
        }
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({
  drawnSet, onMarkDrawn, onUnmarkDrawn, onApply, onClose
}:{
  drawnSet: Set<number>;
  onMarkDrawn: (n:number)=>void;
  onUnmarkDrawn: (n:number)=>void;
  onApply: ()=>void;
  onClose: ()=>void;
}) {
  const [search, setSearch] = useState("");
  const filtered = ALL_NUMS.filter(n => search==="" || n.toString().includes(search));

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center",
      backdropFilter:"blur(8px)",padding:"16px",
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"linear-gradient(150deg,#1A0000,#3A0000,#1A0000)",
        border:"2px solid rgba(212,175,55,0.6)",borderRadius:"20px",
        padding:"clamp(18px,3vw,28px)",
        maxWidth:"min(580px,96vw)",width:"100%",
        maxHeight:"90dvh",display:"flex",flexDirection:"column",gap:"14px",
        boxShadow:"0 0 60px rgba(212,175,55,0.25),0 0 120px rgba(139,0,0,0.5)",
        animation:"modalIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{color:"#FFD700",fontFamily:"'Cinzel Decorative',serif",fontWeight:700,fontSize:"clamp(0.85rem,2.5vw,1.15rem)",letterSpacing:"0.1em"}}>
              ⚙️ Admin Control
            </div>
            <div style={{color:"rgba(212,175,55,0.5)",fontSize:"0.7rem",marginTop:"2px"}}>
              Klik angka untuk tandai/hapus dari daftar sudah ditarik
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",color:"rgba(255,255,255,0.6)",width:"32px",height:"32px",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>✕</button>
        </div>

        {/* Legend */}
        <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
          {[{color:"linear-gradient(135deg,#8B0000,#C41E1E)",border:"#FFD700",label:"✓ Sudah ditarik"},{color:"rgba(212,175,55,0.08)",border:"rgba(212,175,55,0.2)",label:"○ Belum ditarik"}].map(l=>(
            <div key={l.label} style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <div style={{width:"20px",height:"20px",borderRadius:"5px",background:l.color,border:`1px solid ${l.border}`}}/>
              <span style={{color:"rgba(255,255,255,0.55)",fontSize:"0.72rem"}}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* Search */}
        <input
          type="number" min={1} max={TOTAL} placeholder="Cari nomor…"
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{
            background:"rgba(255,255,255,0.06)",border:"1px solid rgba(212,175,55,0.3)",
            borderRadius:"10px",color:"#FFD700",fontFamily:"serif",
            fontSize:"0.85rem",padding:"8px 12px",outline:"none",
            width:"100%",
          }}
        />

        {/* Stats bar */}
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {[
            {label:"Total",val:TOTAL,c:"rgba(255,255,255,0.5)"},
            {label:"Sudah ditarik",val:drawnSet.size,c:"#FFD700"},
            {label:"Tersisa",val:TOTAL-drawnSet.size,c:"#4CAF50"},
          ].map(s=>(
            <div key={s.label} style={{flex:1,minWidth:"80px",background:"rgba(0,0,0,0.35)",borderRadius:"10px",padding:"8px",textAlign:"center",border:"1px solid rgba(212,175,55,0.15)"}}>
              <div style={{color:s.c,fontWeight:700,fontSize:"clamp(1rem,3vw,1.4rem)"}}>{s.val}</div>
              <div style={{color:"rgba(255,255,255,0.35)",fontSize:"0.62rem",marginTop:"2px"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{
          overflowY:"auto",
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill,minmax(46px,1fr))",
          gap:"7px",
          padding:"4px 2px",
          maxHeight:"clamp(180px,35vh,300px)",
        }}>
          {filtered.map(n => {
            const drawn = drawnSet.has(n);
            return (
              <button key={n} onClick={()=> drawn ? onUnmarkDrawn(n) : onMarkDrawn(n)} style={{
                background: drawn?"linear-gradient(135deg,#8B0000,#C41E1E)":"rgba(212,175,55,0.07)",
                border:`1.5px solid ${drawn?"#FFD700":"rgba(212,175,55,0.22)"}`,
                borderRadius:"9px",padding:"8px 4px",
                color: drawn?"#FFD700":"rgba(255,255,255,0.55)",
                fontSize:"clamp(0.72rem,1.8vw,0.85rem)",fontWeight:drawn?700:400,
                cursor:"pointer",textAlign:"center",
                transition:"all 0.15s ease",
                position:"relative",
              }}>
                {drawn && <div style={{position:"absolute",top:"2px",right:"3px",fontSize:"8px",color:"rgba(255,215,0,0.7)"}}>✓</div>}
                {n}
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <button onClick={()=>ALL_NUMS.forEach(n=>!drawnSet.has(n)&&onMarkDrawn(n))} style={{flex:1,minWidth:"120px",background:"rgba(139,0,0,0.35)",border:"1px solid rgba(212,175,55,0.35)",borderRadius:"10px",color:"rgba(255,215,0,0.8)",fontFamily:"serif",fontSize:"0.72rem",padding:"8px",cursor:"pointer"}}>
            Tandai semua
          </button>
          <button onClick={()=>ALL_NUMS.forEach(n=>drawnSet.has(n)&&onUnmarkDrawn(n))} style={{flex:1,minWidth:"120px",background:"rgba(0,80,0,0.2)",border:"1px solid rgba(100,200,100,0.25)",borderRadius:"10px",color:"rgba(120,220,120,0.8)",fontFamily:"serif",fontSize:"0.72rem",padding:"8px",cursor:"pointer"}}>
            Hapus semua tanda
          </button>
        </div>

        {/* Apply */}
        <button onClick={onApply} style={{
          background:"linear-gradient(135deg,#7A0000,#B22222)",
          border:"2px solid #DAA520",borderRadius:"50px",color:"#FFD700",
          fontFamily:"'Cinzel Decorative',serif",fontWeight:700,
          fontSize:"clamp(0.72rem,2vw,0.9rem)",padding:"12px 24px",
          cursor:"pointer",letterSpacing:"0.1em",transition:"all 0.2s",
          boxShadow:"0 4px 20px rgba(139,0,0,0.5)",
        }}>
          ✓ Terapkan Perubahan
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LuckySpinWheel() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number|null>(null);
  const rotRef     = useRef<number>(0);

  const [shuffled,     setShuffled]     = useState<number[]>([]);
  const [pointer,      setPointer]      = useState<number>(0);
  const [spinning,     setSpinning]     = useState<boolean>(false);
  const [winner,       setWinner]       = useState<number|null>(null);
  const [showModal,    setShowModal]    = useState<boolean>(false);
  const [history,      setHistory]      = useState<number[]>([]);
  const [revealPhase,  setRevealPhase]  = useState<RevealPhase>("idle");
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [canvasSize,   setCanvasSize]   = useState<number>(380);
  const [showHistory,  setShowHistory]  = useState<boolean>(false);
  const [showAdmin,    setShowAdmin]    = useState<boolean>(false);
  // Admin: draft set of drawn numbers (before applying)
  const [adminDraft,   setAdminDraft]   = useState<Set<number>>(new Set());

  const remaining = TOTAL - history.length;
  const exhausted = pointer >= shuffled.length;

  // Build initial shuffled queue from ALL_NUMS minus any already-drawn
  const buildQueue = useCallback((drawnSet: Set<number>) => {
    const available = ALL_NUMS.filter(n => !drawnSet.has(n));
    return shuffle(available);
  }, []);

  // Init
  useEffect(()=>{
    setShuffled(buildQueue(new Set()));
  },[buildQueue]);

  // Responsive canvas size
  useEffect(()=>{
    function calc() {
      const vw=window.innerWidth, vh=window.innerHeight;
      const isDesktop = vw>=769;
      const size = isDesktop ? Math.min(vw*0.38,vh*0.52,430) : Math.min(vw-48,vh*0.44,390);
      setCanvasSize(Math.max(size,220));
    }
    calc(); window.addEventListener("resize",calc);
    return ()=>window.removeEventListener("resize",calc);
  },[]);

  useEffect(()=>{ drawWheel(canvasRef.current, ALL_NUMS, rotRef.current); },[canvasSize]);

  // Reveal phase sequencer
  const advanceReveal = useCallback(()=>{
    setRevealPhase(prev=>{
      if(prev==="flash") return "zoom";
      if(prev==="zoom")  return "rise";
      if(prev==="rise")  return "show";
      return prev;
    });
  },[]);

  useEffect(()=>{
    if(revealPhase==="show"){
      setShowModal(true); setShowConfetti(true);
      const t=setTimeout(()=>setShowConfetti(false),4500);
      return ()=>clearTimeout(t);
    }
  },[revealPhase]);

  // Spin
  const spin = useCallback(()=>{
    if(spinning || pointer>=shuffled.length) return;
    const nextNum=shuffled[pointer];
    const count=ALL_NUMS.length, arc=(2*Math.PI)/count;
    const segIdx=ALL_NUMS.indexOf(nextNum);
    const tgtMid=segIdx*arc+arc/2, stopA=-Math.PI/2-tgtMid;
    const extra=(5+Math.floor(Math.random()*6))*2*Math.PI;
    const curRot=rotRef.current;
    const nCur=((curRot%(2*Math.PI))+(2*Math.PI))%(2*Math.PI);
    const nStop=((stopA%(2*Math.PI))+(2*Math.PI))%(2*Math.PI);
    let delta=nStop-nCur; if(delta<=0) delta+=2*Math.PI;
    const totalRot=extra+delta, endRot=curRot+totalRot;
    setSpinning(true);
    const dur=4200+Math.random()*2000, t0=performance.now(), startR=curRot;
    const ease=(t:number)=>1-Math.pow(1-t,3.5);
    function animate(now:number):void {
      const t=Math.min((now-t0)/dur,1);
      const cur=startR+ease(t)*totalRot;
      rotRef.current=cur; drawWheel(canvasRef.current,ALL_NUMS,cur);
      if(t<1){ animRef.current=requestAnimationFrame(animate); }
      else {
        rotRef.current=endRot; setSpinning(false);
        setWinner(nextNum); setHistory(p=>[nextNum,...p]);
        setPointer(p=>p+1);
        setTimeout(()=>setRevealPhase("flash"),350);
      }
    }
    animRef.current=requestAnimationFrame(animate);
  },[spinning,pointer,shuffled]);

  const closeModal=()=>{ setShowModal(false); setRevealPhase("idle"); };

  const hardReset=()=>{
    if(spinning) return;
    setShuffled(buildQueue(new Set()));
    setPointer(0); setHistory([]); setWinner(null);
    setShowModal(false); setRevealPhase("idle");
    rotRef.current=0; drawWheel(canvasRef.current,ALL_NUMS,0);
  };

  // Admin: open — pre-fill draft with current history
  const openAdmin=()=>{
    setAdminDraft(new Set(history));
    setShowAdmin(true);
  };

  // Admin: apply changes — rebuild queue excluding draft drawn set, keep history in sync
  const applyAdmin=()=>{
    const newHistory=Array.from(adminDraft).sort((a,b)=>b-a); // sorted desc so most recent feel is preserved
    // Rebuild queue: remaining numbers not in draft, reshuffled
    const newQueue=buildQueue(adminDraft);
    setHistory(newHistory);
    setShuffled(newQueue);
    setPointer(0);
    setWinner(newHistory.length>0 ? newHistory[0] : null);
    setShowAdmin(false);
    rotRef.current=0; drawWheel(canvasRef.current,ALL_NUMS,0);
  };

  return (
    <div style={{
      minHeight:"100dvh",
      background:"linear-gradient(148deg,#150000 0%,#360000 35%,#150000 65%,#250C00 100%)",
      fontFamily:"'Noto Serif SC','Noto Serif',serif",
      display:"flex",flexDirection:"column",overflowX:"hidden",position:"relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&family=Cinzel+Decorative:wght@700;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        @keyframes confettiFall{0%{transform:translateY(0) rotate(0deg) scaleX(1);opacity:1;}50%{transform:translateY(48vh) rotate(380deg) scaleX(-1);opacity:.9;}100%{transform:translateY(106vh) rotate(760deg);opacity:0;}}
        @keyframes revealFlash{0%{opacity:0;transform:scale(.4);}35%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(2.5);}}
        @keyframes numberZoomIn{0%{opacity:0;transform:translate(-50%,-50%) scale(5);filter:blur(12px);}60%{opacity:1;filter:blur(0);}100%{opacity:1;transform:translate(-50%,-50%) scale(1);filter:blur(0);}}
        @keyframes riseUp{0%{opacity:0;transform:translate(-50%,40%);}100%{opacity:1;transform:translate(-50%,-50%);}}
        @keyframes shockwaveRing{0%{transform:translate(-50%,-50%) scale(.1);opacity:1;}100%{transform:translate(-50%,-50%) scale(3.5);opacity:0;}}
        @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes modalIn{0%{transform:scale(.35) translateY(80px);opacity:0;}60%{transform:scale(1.05) translateY(-5px);opacity:1;}100%{transform:scale(1) translateY(0);opacity:1;}}
        @keyframes lanternSway{0%,100%{transform:rotate(-6deg);}50%{transform:rotate(6deg);}}
        @keyframes goldPulse{0%,100%{opacity:.65;}50%{opacity:1;}}
        @keyframes shimmer{from{background-position:-200% center;}to{background-position:200% center;}}
        @keyframes floatUp{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
        @keyframes winnerGlow{0%,100%{filter:drop-shadow(0 0 10px rgba(255,215,0,.5));}50%{filter:drop-shadow(0 0 32px rgba(255,215,0,1)) drop-shadow(0 0 60px rgba(255,140,0,.7));}}
        @keyframes badgeIn{from{transform:scale(0);opacity:0;}to{transform:scale(1);opacity:1;}}
        @keyframes spinRing{from{transform:translate(-50%,-50%) rotate(0deg);}to{transform:translate(-50%,-50%) rotate(360deg);}}
        @keyframes adminPulse{0%,100%{box-shadow:0 0 0 0 rgba(212,175,55,.4);}50%{box-shadow:0 0 0 6px rgba(212,175,55,0);}}

        .spin-btn{transition:all .2s ease!important;}
        .spin-btn:hover:not(:disabled){background:linear-gradient(135deg,#FF6B00,#FFD700,#FF6B00)!important;transform:scale(1.07) translateY(-2px)!important;box-shadow:0 10px 36px rgba(212,175,55,.7)!important;}
        .spin-btn:active:not(:disabled){transform:scale(.95)!important;}
        .spin-btn:disabled{opacity:.38;cursor:not-allowed;}
        .icon-btn{transition:all .18s ease!important;}
        .icon-btn:hover{background:rgba(212,175,55,.18)!important;border-color:rgba(212,175,55,.6)!important;transform:scale(1.06)!important;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,.02);}
        ::-webkit-scrollbar-thumb{background:rgba(212,175,55,.32);border-radius:2px;}

        .layout{display:flex;flex:1;gap:16px;padding:0 16px 16px;align-items:flex-start;justify-content:center;}
        .side-l{width:185px;min-width:165px;flex-shrink:0;}
        .side-r{width:185px;min-width:165px;flex-shrink:0;}
        @media(max-width:768px){
          .layout{flex-direction:column;align-items:center;padding:0 12px 20px;gap:14px;}
          .side-l{display:none;}
          .side-r{width:100%;min-width:unset;max-width:440px;}
          .mob-hist-btn{display:block!important;}
        }
      `}</style>

      {/* BG overlays */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,backgroundImage:"repeating-linear-gradient(-45deg,rgba(212,175,55,0.022) 0px,rgba(212,175,55,0.022) 1px,transparent 1px,transparent 34px)"}}/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,background:"radial-gradient(ellipse 65% 55% at 50% 38%,rgba(139,0,0,0.22) 0%,transparent 70%)"}}/>

      {showConfetti && <ConfettiExplosion/>}
      {winner!==null && <RevealOverlay winner={winner} phase={revealPhase} onNext={advanceReveal}/>}
      {showAdmin && (
        <AdminPanel
          drawnSet={adminDraft}
          onMarkDrawn={n=>setAdminDraft(s=>{const ns=new Set(s);ns.add(n);return ns;})}
          onUnmarkDrawn={n=>setAdminDraft(s=>{const ns=new Set(s);ns.delete(n);return ns;})}
          onApply={applyAdmin}
          onClose={()=>setShowAdmin(false)}
        />
      )}

      {/* Lanterns */}
      <div style={{display:"flex",justifyContent:"center",gap:"clamp(14px,3.5vw,40px)",padding:"12px 0 4px",position:"relative",zIndex:10}}>
        {["🏮","🏮","🏮","🏮","🏮"].map((l,i)=>(
          <div key={i} style={{fontSize:"clamp(1rem,3vw,1.8rem)",animation:`lanternSway ${1.8+i*0.3}s ease-in-out infinite`,transformOrigin:"top center",animationDelay:`${i*0.18}s`,filter:"drop-shadow(0 3px 8px rgba(255,70,0,0.7))"}}>
            {l}
          </div>
        ))}
      </div>

      {/* Header */}
      <header style={{textAlign:"center",padding:"2px 16px 10px",position:"relative",zIndex:10}}>
        <h1 style={{margin:0,fontSize:"clamp(1.3rem,4.5vw,2.4rem)",fontFamily:"'Cinzel Decorative',serif",fontWeight:900,background:"linear-gradient(90deg,#9B6914,#DAA520,#FFF8DC,#FFD700,#DAA520,#9B6914)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 3.5s linear infinite",letterSpacing:"0.04em",lineHeight:1.2}}>
          Lucky Spin Wheel
        </h1>
        <p style={{margin:"3px 0 0",color:"rgba(212,175,55,0.6)",fontSize:"clamp(0.58rem,1.7vw,0.82rem)",letterSpacing:"0.22em",fontFamily:"serif"}}>
          🐍 新年快乐 · Year of the Snake · 2025 🐍
        </p>
      </header>

      {/* Layout */}
      <div className="layout" style={{position:"relative",zIndex:10}}>

        {/* LEFT */}
        <div className="side-l">
          <HistoryPanel history={history} remaining={remaining}/>
        </div>

        {/* CENTER */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"14px",flexShrink:0}}>

          {/* Wheel */}
          <div style={{position:"relative",animation:"floatUp 4.5s ease-in-out infinite"}}>
            <div style={{position:"absolute",inset:"-14px",borderRadius:"50%",background:"conic-gradient(from 0deg,#8B0000 0%,#DAA520 12.5%,#8B0000 25%,#DAA520 37.5%,#8B0000 50%,#DAA520 62.5%,#8B0000 75%,#DAA520 87.5%,#8B0000 100%)",zIndex:0,animation:"goldPulse 2.8s ease-in-out infinite"}}/>
            <div style={{position:"absolute",inset:"-7px",borderRadius:"50%",background:"linear-gradient(135deg,#150000,#360000)",zIndex:1}}/>
            {spinning&&<div style={{position:"absolute",top:"50%",left:"50%",width:`${canvasSize+36}px`,height:`${canvasSize+36}px`,borderRadius:"50%",border:"2px dashed rgba(255,215,0,0.35)",animation:"spinRing 2s linear infinite",zIndex:3,pointerEvents:"none"}}/>}
            <canvas ref={canvasRef} width={canvasSize} height={canvasSize}
              style={{borderRadius:"50%",position:"relative",zIndex:2,cursor:spinning||exhausted?"not-allowed":"pointer",display:"block",touchAction:"manipulation"}}
              onClick={!spinning&&!exhausted?spin:undefined}
            />
            {/* Pointer */}
            <div style={{position:"absolute",top:"-2px",left:"50%",transform:"translateX(-50%)",zIndex:10,filter:"drop-shadow(0 5px 10px rgba(0,0,0,0.95))"}}>
              <svg width={Math.max(canvasSize*0.09,26)} height={Math.max(canvasSize*0.115,34)} viewBox="0 0 36 48">
                <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFF8DC"/><stop offset="50%" stopColor="#FFD700"/><stop offset="100%" stopColor="#9B6914"/></linearGradient></defs>
                <polygon points="18,44 1,5 35,5" fill="url(#ag)" stroke="#3A1E00" strokeWidth="2"/>
                <circle cx="18" cy="7" r="5.5" fill="#FFD700" stroke="#3A1E00" strokeWidth="1.5"/>
                <circle cx="18" cy="7" r="2" fill="#FFF8DC"/>
              </svg>
            </div>
          </div>

          {/* Buttons row */}
          <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
            <button className="spin-btn" onClick={spin} disabled={spinning||exhausted} style={{
              background:"linear-gradient(135deg,#7A0000,#B22222,#7A0000)",border:"2px solid #DAA520",borderRadius:"50px",color:"#FFD700",
              fontFamily:"'Cinzel Decorative',serif",fontWeight:700,fontSize:"clamp(0.7rem,2.3vw,0.96rem)",
              padding:"clamp(10px,2vw,13px) clamp(18px,4vw,32px)",cursor:spinning||exhausted?"not-allowed":"pointer",
              letterSpacing:"0.12em",boxShadow:"0 4px 22px rgba(139,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07)",whiteSpace:"nowrap",
            }}>{spinning?"✨ SPINNING...":exhausted?"ALL DRAWN!":"🎰 SPIN"}</button>

            {/* Admin button */}
            <button className="icon-btn" onClick={openAdmin} title="Admin Panel" style={{
              background:"rgba(212,175,55,0.09)",border:"1px solid rgba(212,175,55,0.3)",
              borderRadius:"50px",color:"rgba(212,175,55,0.8)",fontSize:"clamp(0.7rem,1.9vw,0.82rem)",
              padding:"clamp(10px,2vw,13px) clamp(10px,2.2vw,16px)",cursor:"pointer",
              fontFamily:"serif",letterSpacing:"0.06em",whiteSpace:"nowrap",
              animation:"adminPulse 3s ease-in-out infinite",
            }}>⚙️ Admin</button>

            {/* Reset */}
            <button className="icon-btn" onClick={hardReset} disabled={spinning} style={{
              background:"rgba(212,175,55,0.06)",border:"1px solid rgba(212,175,55,0.25)",
              borderRadius:"50px",color:"rgba(212,175,55,0.6)",fontFamily:"serif",
              fontSize:"clamp(0.66rem,1.8vw,0.8rem)",padding:"clamp(10px,2vw,13px) clamp(8px,1.8vw,14px)",
              cursor:spinning?"not-allowed":"pointer",letterSpacing:"0.06em",whiteSpace:"nowrap",opacity:spinning?.38:1,
            }}>🔄</button>
          </div>

          {exhausted&&<div style={{color:"#FFD700",fontSize:"clamp(0.7rem,1.8vw,0.86rem)",textAlign:"center",background:"rgba(139,0,0,0.28)",border:"1px solid rgba(212,175,55,0.36)",borderRadius:"12px",padding:"9px 16px",maxWidth:"300px"}}>🎉 Semua {TOTAL} angka sudah ditarik!</div>}

          {/* Mobile history toggle */}
          <button className="mob-hist-btn" onClick={()=>setShowHistory(o=>!o)} style={{display:"none",background:"rgba(139,0,0,0.28)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:"50px",color:"#FFD700",fontFamily:"serif",fontSize:"0.77rem",padding:"7px 16px",cursor:"pointer",letterSpacing:"0.09em"}}>
            📜 History ({history.length})
          </button>
        </div>

        {/* RIGHT */}
        <div className="side-r">
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            {/* Last winner */}
            <div style={{background:"rgba(0,0,0,0.44)",border:"1px solid rgba(212,175,55,0.28)",borderRadius:"14px",padding:"14px",backdropFilter:"blur(12px)",textAlign:"center"}}>
              <div style={{color:"rgba(212,175,55,0.5)",fontSize:"0.66rem",letterSpacing:"0.24em",marginBottom:"5px"}}>LAST WINNER</div>
              <div style={{fontSize:"clamp(1.9rem,5.5vw,3rem)",fontWeight:900,color:"#FFD700",lineHeight:1,textShadow:"0 0 22px rgba(255,215,0,0.48)",animation:winner?"winnerGlow 2s ease-in-out infinite":"none"}}>{winner??"—"}</div>
            </div>
            {/* Progress */}
            <div style={{background:"rgba(0,0,0,0.44)",border:"1px solid rgba(212,175,55,0.28)",borderRadius:"14px",padding:"14px",backdropFilter:"blur(12px)"}}>
              <div style={{color:"rgba(212,175,55,0.5)",fontSize:"0.66rem",letterSpacing:"0.24em",marginBottom:"8px",textAlign:"center"}}>PROGRESS</div>
              <div style={{background:"rgba(255,255,255,0.05)",borderRadius:"5px",height:"6px",overflow:"hidden",marginBottom:"7px"}}>
                <div style={{height:"100%",width:`${(history.length/TOTAL)*100}%`,background:"linear-gradient(90deg,#8B0000,#FFD700)",borderRadius:"5px",transition:"width 0.55s ease",boxShadow:"0 0 7px rgba(255,215,0,0.38)"}}/>
              </div>
              <div style={{color:"#FFD700",fontSize:"clamp(1.05rem,2.8vw,1.4rem)",fontWeight:700,textAlign:"center"}}>
                {history.length}<span style={{color:"rgba(255,255,255,0.22)",fontSize:"0.8rem"}}>/{TOTAL}</span>
              </div>
            </div>
            {/* Lucky charms */}
            <div style={{background:"rgba(0,0,0,0.44)",border:"1px solid rgba(212,175,55,0.28)",borderRadius:"14px",padding:"14px",backdropFilter:"blur(12px)",textAlign:"center"}}>
              <div style={{color:"rgba(212,175,55,0.5)",fontSize:"0.66rem",letterSpacing:"0.24em",marginBottom:"8px"}}>LUCKY CHARMS</div>
              <div style={{fontSize:"clamp(1.1rem,3.2vw,1.5rem)",lineHeight:1.95,letterSpacing:"0.12em"}}>🐉 🏮 💰<br/>🌸 🎊 ✨</div>
            </div>
            {/* Mobile inline history */}
            {showHistory&&<div style={{animation:"fadeIn 0.3s ease-out"}}><HistoryPanel history={history} remaining={remaining}/></div>}
          </div>
        </div>
      </div>

      {/* Winner Modal */}
      {showModal&&winner!==null&&revealPhase==="show"&&(
        <div onClick={closeModal} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:95,backdropFilter:"blur(7px)",padding:"16px"}}>
          <div onClick={(e:React.MouseEvent)=>e.stopPropagation()} style={{
            background:"linear-gradient(152deg,#1A0000,#400000,#1A0000)",border:"2px solid #DAA520",borderRadius:"20px",
            padding:"clamp(22px,5vw,42px) clamp(26px,6.5vw,58px)",textAlign:"center",position:"relative",zIndex:96,
            animation:"modalIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards",
            boxShadow:"0 0 55px rgba(212,175,55,0.38),0 0 100px rgba(139,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.06)",
            maxWidth:"min(480px,92vw)",width:"100%",
          }}>
            {(["tl","tr","bl","br"] as const).map(c=>(
              <div key={c} style={{position:"absolute",top:c[0]==="t"?"10px":"auto",bottom:c[0]==="b"?"10px":"auto",left:c[1]==="l"?"10px":"auto",right:c[1]==="r"?"10px":"auto",fontSize:"clamp(0.9rem,2.5vw,1.4rem)",opacity:.5}}>🏵️</div>
            ))}
            <div style={{width:"55%",height:"1px",margin:"0 auto 12px",background:"linear-gradient(90deg,transparent,#DAA520,transparent)"}}/>
            <div style={{color:"rgba(212,175,55,0.62)",fontSize:"clamp(0.55rem,1.7vw,0.75rem)",letterSpacing:"0.5em",marginBottom:"5px"}}>✦ LUCKY NUMBER ✦</div>
            <div style={{fontSize:"clamp(4rem,20vw,9rem)",fontWeight:900,lineHeight:1,fontFamily:"'Cinzel Decorative',serif",background:"linear-gradient(180deg,#FFF8DC 0%,#FFD700 35%,#DAA520 72%,#9B6914 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"winnerGlow 1.8s ease-in-out infinite",margin:"10px 0"}}>
              {winner}
            </div>
            <div style={{color:"#FFD700",fontSize:"clamp(0.8rem,2.8vw,1.1rem)",letterSpacing:"0.14em",marginBottom:"4px"}}>🎊 恭喜发财 · Congratulations! 🎊</div>
            <div style={{color:"rgba(255,255,255,0.32)",fontSize:"clamp(0.6rem,1.6vw,0.77rem)",marginBottom:"18px"}}>
              Number {history.length} of {TOTAL} drawn
            </div>
            <div style={{width:"55%",height:"1px",margin:"0 auto 18px",background:"linear-gradient(90deg,transparent,#DAA520,transparent)"}}/>
            <button onClick={closeModal} style={{background:"linear-gradient(135deg,#7A0000,#B22222)",border:"1px solid #DAA520",borderRadius:"50px",color:"#FFD700",fontFamily:"'Cinzel Decorative',serif",fontWeight:700,fontSize:"clamp(0.68rem,2.2vw,0.88rem)",padding:"clamp(9px,1.8vw,12px) clamp(22px,5.5vw,34px)",cursor:"pointer",letterSpacing:"0.12em",transition:"all 0.2s"}}>
              CONTINUE →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}