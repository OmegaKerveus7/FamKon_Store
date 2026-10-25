import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
let modelos: Promise<FaceLandmarker> | undefined;
function cargar() {
  return modelos ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks('/vision/wasm');
    return FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/vision/face_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 2 });
  })().catch(e => { modelos = undefined; throw e; });
}
export type FotoCarnet = { imagen: HTMLCanvasElement; puntos: NormalizedLandmark[] };
export type FiltroFoto = 'original'|'calido'|'blanco_negro'|'contraste'|'glitch'|'distorsionado';
export const FILTROS_FOTO: { codigo: FiltroFoto; nombre: string; descripcion: string; css: string }[] = [
  { codigo: 'original', nombre: 'Original', descripcion: 'Colores naturales', css: 'none' },
  { codigo: 'calido', nombre: 'Cálido', descripcion: 'Luz dorada', css: 'sepia(.38) saturate(1.3) brightness(1.05)' },
  { codigo: 'blanco_negro', nombre: 'B/N', descripcion: 'Estilo clásico', css: 'grayscale(1) contrast(1.16) brightness(1.03)' },
  { codigo: 'contraste', nombre: 'Intenso', descripcion: 'Color definido', css: 'contrast(1.42) saturate(1.3) brightness(1.02)' },
  { codigo: 'glitch', nombre: 'Glitch', descripcion: 'Fallo digital', css: 'contrast(1.2) saturate(1.5) drop-shadow(3px 0 0 rgba(255,0,80,.55)) drop-shadow(-3px 0 0 rgba(0,220,255,.55))' },
  { codigo: 'distorsionado', nombre: 'Distorsión', descripcion: 'Ondas locas', css: 'blur(.8px) saturate(1.3) contrast(1.05)' },
];
export function cssFiltroFoto(filtro: FiltroFoto) { return FILTROS_FOTO.find(item => item.codigo === filtro)?.css ?? 'none'; }
export function esFiltroEspecial(filtro: FiltroFoto) { return filtro === 'glitch' || filtro === 'distorsionado'; }

/** Glitch (separación de canales + bandas) y distorsión por ondas. Se dibujan sobre el lienzo final. */
export function dibujarFiltroEspecial(ctx: CanvasRenderingContext2D, imagen: CanvasImageSource, filtro: FiltroFoto) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const margen = 24;
  const temp = document.createElement('canvas');
  temp.width = w + margen * 2;
  temp.height = h;
  const t = temp.getContext('2d');
  if (!t) return;

  if (filtro === 'distorsionado') {
    // Se dibuja con sangrado y se muestrea corrido para que no queden huecos.
    t.filter = 'saturate(1.35) contrast(1.08)';
    t.drawImage(imagen, -margen - w * 0.05, -h * 0.02, w * 1.1 + margen * 2, h * 1.04);
    const franja = 2;
    for (let y = 0; y < h; y += franja) {
      const dx = Math.sin((y / h) * Math.PI * 6) * 16;
      ctx.drawImage(temp, margen + dx, y, w, franja, 0, y, w, franja);
    }
    return;
  }

  t.filter = 'contrast(1.12) saturate(1.45)';
  t.drawImage(imagen, margen, 0);
  const base = t.getImageData(0, 0, temp.width, h);
  const salida = ctx.createImageData(w, h);
  const origen = base.data;
  const destino = salida.data;
  const columnas = temp.width;
  const shift = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const xr = Math.max(0, x + margen - shift);
      const xb = Math.min(columnas - 1, x + margen + shift);
      destino[i] = origen[(y * columnas + xr) * 4];
      destino[i + 1] = origen[(y * columnas + x + margen) * 4 + 1];
      destino[i + 2] = origen[(y * columnas + xb) * 4 + 2];
      destino[i + 3] = 255;
    }
  }
  ctx.putImageData(salida, 0, 0);

  for (let i = 0; i < 8; i++) {
    const y = Math.floor((i / 8) * h + ((i * 37) % 40));
    const alto = Math.max(5, Math.floor(h / 24 + (i % 3) * 5));
    const dx = (i % 2 ? 1 : -1) * (7 + (i % 3) * 5);
    ctx.drawImage(temp, margen, y, w, alto, dx, y, w, alto);
  }

  ctx.fillStyle = 'rgba(2,6,23,.16)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
}
export async function prepararFotoCarnet(src: string): Promise<FotoCarnet> {
  const img = new Image(); img.src = src; await img.decode();
  const face = await cargar();
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  // Mantener la foto completa: no cortar orejas o cabello antes de detectar.
  const scale = Math.min(512 / img.width, 512 / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (512-w)/2, (512-h)/2, w, h);
  const faces = face.detect(canvas).faceLandmarks;
  if (faces.length !== 1) throw new Error(faces.length ? 'Debe aparecer solamente una persona en la foto.' : 'No detectamos un rostro. Toma otra foto mirando a la cámara.');
  // Encuadre 3:4 centrado en el rostro, con margen para cabello y hombros.
  const puntos = faces[0];
  const xs = puntos.map(p => p.x * 512), ys = puntos.map(p => p.y * 512);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const altoRostro = maxY - minY;
  const alto = Math.max(altoRostro * 1.95, (maxX - minX) * 1.65 / .75);
  const ancho = alto * .75;
  const x = (minX + maxX) / 2 - ancho / 2;
  const y = minY - altoRostro * .4;
  const retrato = document.createElement('canvas'); retrato.width = 384; retrato.height = 512;
  const retratoCtx = retrato.getContext('2d')!;
  // Una sola escala preserva proporciones; el espacio fuera de la captura queda transparente.
  retratoCtx.drawImage(canvas, -x * 384 / ancho, -y * 512 / alto, 512 * 384 / ancho, 512 * 512 / alto);
  return { imagen: retrato, puntos: puntos.map(p => ({ ...p, x: (p.x * 512-x)/ancho, y: (p.y * 512-y)/alto })) };
}
export type Efecto = 'ninguno'|'perrito'|'gatito'|'conejito'|'payasito'|'gafas'|'gafas_sol'|'llamas'|'osito'|'corona'|'sombrero'|'lazo'|'estrellas'|'cuerno';
export type DesplazamientoEfecto = { x: number; y: number };
export function dibujarEfecto(ctx: CanvasRenderingContext2D, puntos: NormalizedLandmark[], efecto: Efecto, desplazamiento: DesplazamientoEfecto = { x: 0, y: 0 }, escalaObjeto = 1) {
  if (efecto === 'ninguno') return;
  const factor = Math.min(2.5, Math.max(0.35, escalaObjeto));
  const left=puntos[33], right=puntos[263], nose=puntos[1];
  const width=ctx.canvas.width, height=ctx.canvas.height;
  const dx=(right.x-left.x)*width, dy=(right.y-left.y)*height;
  const distance=Math.hypot(dx,dy);
  const angulo=Math.atan2(dy,dx);
  const escala=distance/100;

  // Centros de los ojos (para gafas y llamas), en píxeles del lienzo.
  const ojoD = {
    x: ((puntos[33].x + puntos[133].x) / 2) * width,
    y: ((puntos[33].y + puntos[133].y) / 2) * height,
  };
  const ojoI = {
    x: ((puntos[362].x + puntos[263].x) / 2) * width,
    y: ((puntos[362].y + puntos[263].y) / 2) * height,
  };
  const centroOjos = {
    x: (ojoD.x + ojoI.x) / 2 + desplazamiento.x,
    y: (ojoD.y + ojoI.y) / 2 + desplazamiento.y,
  };
  const escalaOjos = Math.hypot(ojoI.x - ojoD.x, ojoI.y - ojoD.y) / 100;

  if (efecto === 'gafas' || efecto === 'gafas_sol') {
    const sol = efecto === 'gafas_sol';
    ctx.save();
    ctx.translate(centroOjos.x, centroOjos.y);
    ctx.rotate(angulo);
    ctx.scale(escalaOjos * factor, escalaOjos * factor);
    ctx.lineWidth = 5;
    ctx.strokeStyle = sol ? '#0f172a' : '#334155';
    ctx.fillStyle = sol ? 'rgba(15,23,42,.85)' : 'rgba(255,255,255,.3)';
    for (const x of [-50, 50]) {
      ctx.beginPath();
      ctx.ellipse(x, 0, 27, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-23, -3);
    ctx.quadraticCurveTo(0, -9, 23, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-77, -6);
    ctx.lineTo(-102, -14);
    ctx.moveTo(77, -6);
    ctx.lineTo(102, -14);
    ctx.stroke();
    if (sol) {
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-64, -10);
      ctx.lineTo(-44, 4);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (efecto === 'llamas') {
    ctx.save();
    ctx.translate(centroOjos.x, centroOjos.y);
    ctx.rotate(angulo);
    ctx.scale(escalaOjos * factor, escalaOjos * factor);
    const llama = (x: number, y: number, alto: number, color: string) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x - 17, y - alto * 0.35, x - 7, y - alto * 0.8, x, y - alto);
      ctx.bezierCurveTo(x + 7, y - alto * 0.8, x + 17, y - alto * 0.35, x, y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    const xs = [-100, -66, -33, 0, 33, 66, 100];
    xs.forEach((x, i) => {
      const alto = 60 + (i % 3) * 24;
      llama(x, -92, alto + 20, i % 2 ? '#f97316' : '#ef4444');
      llama(x, -92, alto, i % 2 ? '#facc15' : '#fb923c');
    });
    ctx.restore();
    return;
  }

  ctx.save(); ctx.translate(nose.x*width+desplazamiento.x,nose.y*height+desplazamiento.y); ctx.rotate(angulo); ctx.scale(escala*factor,escala*factor);
  const ellipse=(x:number,y:number,rx:number,ry:number,color:string,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;};
  const ear=(x:number,color:string,inner:string)=>{ctx.fillStyle=color;ctx.strokeStyle='rgba(15,23,42,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-20,-57);ctx.quadraticCurveTo(x-18,-105,x,-126);ctx.quadraticCurveTo(x+20,-88,x+22,-55);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=inner;ctx.beginPath();ctx.moveTo(x-12,-65);ctx.quadraticCurveTo(x-10,-96,x,-111);ctx.quadraticCurveTo(x+11,-86,x+13,-64);ctx.closePath();ctx.fill();};
  if(efecto==='perrito') { ellipse(-69,-72,24,42,'#8b5e3c',.9);ellipse(69,-72,24,42,'#8b5e3c',.9);ellipse(-69,-72,12,29,'#d6a27f',.85);ellipse(69,-72,12,29,'#d6a27f',.85);ellipse(0,1,13,9,'#27272a',.9);ctx.strokeStyle='rgba(39,39,42,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,8);ctx.quadraticCurveTo(-8,18,-17,16);ctx.moveTo(0,8);ctx.quadraticCurveTo(8,18,17,16);ctx.stroke();ellipse(5,31,8,13,'#fb7185',.78); }
  if(efecto==='gatito') { ear(-48,'rgba(71,85,105,.88)','rgba(251,113,133,.72)');ear(48,'rgba(71,85,105,.88)','rgba(251,113,133,.72)');ellipse(0,1,9,6,'#fb7185',.9);ctx.strokeStyle='rgba(30,41,59,.72)';ctx.lineWidth=2;ctx.lineCap='round';for(const sign of [-1,1])for(const offset of [-7,2,11]){ctx.beginPath();ctx.moveTo(sign*14,10);ctx.quadraticCurveTo(sign*38,8+offset/3,sign*62,7+offset);ctx.stroke();} }
  if(efecto==='conejito') { ellipse(-34,-103,15,50,'rgba(255,247,237,.94)');ellipse(34,-103,15,50,'rgba(255,247,237,.94)');ellipse(-34,-103,7,37,'rgba(249,168,212,.72)');ellipse(34,-103,7,37,'rgba(249,168,212,.72)');ellipse(0,1,9,6,'#f472b6',.9);ctx.fillStyle='rgba(255,255,255,.92)';ctx.roundRect(-9,24,8,13,2);ctx.roundRect(1,24,8,13,2);ctx.fill(); }
  if(efecto==='payasito') { ellipse(0,1,13,13,'#ef4444',.82);ellipse(-38,14,12,8,'#fb7185',.42);ellipse(38,14,12,8,'#fb7185',.42);ellipse(-55,-62,17,17,'#38bdf8',.82);ellipse(55,-62,17,17,'#facc15',.82); }
  if(efecto==='osito') { ellipse(-70,-74,30,30,'#8b5e3c',.95);ellipse(70,-74,30,30,'#8b5e3c',.95);ellipse(-70,-74,18,18,'#d6a27f',.9);ellipse(70,-74,18,18,'#d6a27f',.9);ellipse(0,32,18,11,'#8b5e3c',.9);ellipse(0,30,7,5,'#27272a',.95); }
  if(efecto==='corona') {
    ctx.fillStyle='#facc15'; ctx.strokeStyle='rgba(120,53,15,.65)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(-72,-78); ctx.lineTo(-54,-128); ctx.lineTo(-27,-94); ctx.lineTo(0,-138); ctx.lineTo(27,-94); ctx.lineTo(54,-128); ctx.lineTo(72,-78); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#eab308'; ctx.fillRect(-72,-84,144,12);
    ellipse(-40,-78,5,5,'#ef4444',1); ellipse(0,-78,5,5,'#38bdf8',1); ellipse(40,-78,5,5,'#a3e635',1);
  }
  if(efecto==='sombrero') {
    ctx.fillStyle='#0f172a';
    ctx.beginPath(); ctx.ellipse(0,-96,80,14,0,0,Math.PI*2); ctx.fill();
    ctx.fillRect(-38,-170,76,76);
    ctx.fillStyle='#b91c1c'; ctx.fillRect(-38,-118,76,13);
  }
  if(efecto==='lazo') {
    ctx.fillStyle='#ec4899';
    ctx.beginPath(); ctx.ellipse(-30,-118,26,18,-0.35,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30,-118,26,18,0.35,0,Math.PI*2); ctx.fill();
    ellipse(0,-118,10,12,'#db2777',1);
  }
  if(efecto==='estrellas') {
    const estrella=(x:number,y:number,r:number,color:string)=>{ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;const rr=i%2===0?r:r*.45;const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.closePath();ctx.fillStyle=color;ctx.fill();};
    estrella(-98,-88,14,'#facc15'); estrella(98,-94,12,'#facc15'); estrella(-72,-152,10,'#fde047'); estrella(72,-150,11,'#fde047'); estrella(0,-186,9,'#fde047');
  }
  if(efecto==='cuerno') {
    const grad=ctx.createLinearGradient(0,-96,0,-200);
    grad.addColorStop(0,'#fbcfe8'); grad.addColorStop(1,'#f9a8d4');
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.moveTo(-17,-96); ctx.lineTo(0,-198); ctx.lineTo(17,-96); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(190,24,93,.55)'; ctx.lineWidth=3;
    for(let i=1;i<=4;i++){ const y=-96-i*22; const w=16*(1-i/5); ctx.beginPath(); ctx.moveTo(-w,y); ctx.lineTo(w,y-4); ctx.stroke(); }
  }
  ctx.restore();
}
