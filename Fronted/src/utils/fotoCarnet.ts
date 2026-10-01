import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
let modelos: Promise<FaceLandmarker> | undefined;
function cargar() {
  return modelos ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks('/vision/wasm');
    return FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/vision/face_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 2 });
  })().catch(e => { modelos = undefined; throw e; });
}
export type FotoCarnet = { imagen: HTMLCanvasElement; puntos: NormalizedLandmark[] };
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
export type Efecto = 'ninguno'|'perrito'|'gatito'|'conejito'|'payasito';
export function dibujarEfecto(ctx: CanvasRenderingContext2D, puntos: NormalizedLandmark[], efecto: Efecto) {
  if (efecto === 'ninguno') return;
  const left=puntos[33], right=puntos[263], nose=puntos[1];
  const width=ctx.canvas.width, height=ctx.canvas.height;
  const dx=(right.x-left.x)*width, dy=(right.y-left.y)*height;
  const distance=Math.hypot(dx,dy);
  ctx.save(); ctx.translate(nose.x*width,nose.y*height); ctx.rotate(Math.atan2(dy,dx)); ctx.scale(distance/100,distance/100);
  const ellipse=(x:number,y:number,rx:number,ry:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
  const triangle=(x:number,y:number,color:string)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x-22,y+30);ctx.lineTo(x,y-22);ctx.lineTo(x+22,y+30);ctx.closePath();ctx.fill();};
  if(efecto==='perrito') { ellipse(-90,-65,21,48,'#8b512d');ellipse(90,-65,21,48,'#8b512d');ellipse(-90,-60,11,33,'#d59b7a');ellipse(90,-60,11,33,'#d59b7a');ellipse(0,0,15,10,'#29201c');ellipse(5,36,10,17,'#f5839d'); }
  if(efecto==='gatito') { triangle(-56,-80,'#52525b');triangle(56,-80,'#52525b');triangle(-56,-73,'#fda4af');triangle(56,-73,'#fda4af');ellipse(0,0,10,7,'#fb7185');ctx.strokeStyle='#3f3f46';ctx.lineWidth=2;for(const sign of [-1,1])for(const dy of [-9,0,9]){ctx.beginPath();ctx.moveTo(sign*15,8);ctx.lineTo(sign*60,8+dy);ctx.stroke();} }
  if(efecto==='conejito') { ellipse(-40,-102,16,55,'#fff7ed');ellipse(40,-102,16,55,'#fff7ed');ellipse(-40,-103,8,42,'#f9a8d4');ellipse(40,-103,8,42,'#f9a8d4');ellipse(0,0,10,7,'#f472b6');ctx.fillStyle='white';ctx.fillRect(-10,28,9,14);ctx.fillRect(1,28,9,14); }
  if(efecto==='payasito') { ellipse(0,0,16,16,'#ef4444');ellipse(-40,12,14,10,'#fb7185');ellipse(40,12,14,10,'#fb7185');ellipse(-65,-65,20,20,'#38bdf8');ellipse(65,-65,20,20,'#facc15'); }
  ctx.restore();
}
