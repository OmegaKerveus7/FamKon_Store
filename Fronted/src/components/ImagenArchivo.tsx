import { useEffect, useState } from "react";
import { fotoCompra } from "../api/compras";

interface Props {
  id: number;
  alt: string;
  className?: string;
  enlace?: boolean;
}

export default function ImagenArchivo({ id, alt, className, enlace = true }: Props) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    let recurso = "";
    const controller = new AbortController();
    setUrl("");
    setError(false);
    fotoCompra(id, controller.signal)
      .then((u) => {
        recurso = u;
        if (activo) setUrl(u);
        else URL.revokeObjectURL(u);
      })
      .catch(() => {
        if (activo) setError(true);
      });
    return () => {
      activo = false;
      controller.abort();
      if (recurso) URL.revokeObjectURL(recurso);
    };
  }, [id]);

  if (error) {
    return <span className={`flex items-center justify-center text-[10px] text-slate-400 ${className ?? ""}`}>No disponible</span>;
  }
  if (!url) {
    return <span className={`block animate-pulse rounded-md bg-slate-200 ${className ?? ""}`} />;
  }
  if (enlace) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt={alt} className={className} />
      </a>
    );
  }
  return <img src={url} alt={alt} className={className} />;
}
