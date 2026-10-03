import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
let modelos: Promise<FaceLandmarker> | undefined;
function cargar() {
  return modelos ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks('/vision/wasm');
    return FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: '/vision/face_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 2 });
  })().catch(e => { modelos = undefined; throw e; });
}
export type FotoCarnet = { imagen: HTMLCanvasElement; puntos: NormalizedLandmark[] };
export type FiltroFoto = 'original'|'calido'|'blanco_negro'|'contraste';
export const FILTROS_FOTO: { codigo: FiltroFoto; nombre: string; descripcion: string; css: string }[] = [
  { codigo: 'original', nombre: 'Original', descripcion: 'Colores naturales', css: 'none' },
  { codigo: 'calido', nombre: 'Cálido', descripcion: 'Luz dorada', css: 'sepia(.38) saturate(1.3) brightness(1.05)' },
  { codigo: 'blanco_negro', nombre: 'B/N', descripcion: 'Estilo clásico', css: 'grayscale(1) contrast(1.16) brightness(1.03)' },
  { codigo: 'contraste', nombre: 'Intenso', descripcion: 'Color definido', css: 'contrast(1.42) saturate(1.3) brightness(1.02)' },
];
export function cssFiltroFoto(filtro: FiltroFoto) { return FILTROS_FOTO.find(item => item.codigo === filtro)?.css ?? 'none'; }
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
  const ellipse=(x:number,y:number,rx:number,ry:number,color:string,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;};
  const ear=(x:number,color:string,inner:string)=>{ctx.fillStyle=color;ctx.strokeStyle='rgba(15,23,42,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-20,-57);ctx.quadraticCurveTo(x-18,-105,x,-126);ctx.quadraticCurveTo(x+20,-88,x+22,-55);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=inner;ctx.beginPath();ctx.moveTo(x-12,-65);ctx.quadraticCurveTo(x-10,-96,x,-111);ctx.quadraticCurveTo(x+11,-86,x+13,-64);ctx.closePath();ctx.fill();};
  if(efecto==='perrito') { ellipse(-69,-72,24,42,'#8b5e3c',.9);ellipse(69,-72,24,42,'#8b5e3c',.9);ellipse(-69,-72,12,29,'#d6a27f',.85);ellipse(69,-72,12,29,'#d6a27f',.85);ellipse(0,1,13,9,'#27272a',.9);ctx.strokeStyle='rgba(39,39,42,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,8);ctx.quadraticCurveTo(-8,18,-17,16);ctx.moveTo(0,8);ctx.quadraticCurveTo(8,18,17,16);ctx.stroke();ellipse(5,31,8,13,'#fb7185',.78); }
  if(efecto==='gatito') { ear(-48,'rgba(71,85,105,.88)','rgba(251,113,133,.72)');ear(48,'rgba(71,85,105,.88)','rgba(251,113,133,.72)');ellipse(0,1,9,6,'#fb7185',.9);ctx.strokeStyle='rgba(30,41,59,.72)';ctx.lineWidth=2;ctx.lineCap='round';for(const sign of [-1,1])for(const offset of [-7,2,11]){ctx.beginPath();ctx.moveTo(sign*14,10);ctx.quadraticCurveTo(sign*38,8+offset/3,sign*62,7+offset);ctx.stroke();} }
  if(efecto==='conejito') { ellipse(-34,-103,15,50,'rgba(255,247,237,.94)');ellipse(34,-103,15,50,'rgba(255,247,237,.94)');ellipse(-34,-103,7,37,'rgba(249,168,212,.72)');ellipse(34,-103,7,37,'rgba(249,168,212,.72)');ellipse(0,1,9,6,'#f472b6',.9);ctx.fillStyle='rgba(255,255,255,.92)';ctx.roundRect(-9,24,8,13,2);ctx.roundRect(1,24,8,13,2);ctx.fill(); }
  if(efecto==='payasito') { ellipse(0,1,13,13,'#ef4444',.82);ellipse(-38,14,12,8,'#fb7185',.42);ellipse(38,14,12,8,'#fb7185',.42);ellipse(-55,-62,17,17,'#38bdf8',.82);ellipse(55,-62,17,17,'#facc15',.82); }
  ctx.restore();
}
