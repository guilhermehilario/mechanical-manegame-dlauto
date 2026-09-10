import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkOrderImageDto } from '@mechanic-system/types';
import { ApiClientError } from '../../services/api-client';
import {
  deleteWorkOrderImage,
  fetchImageObjectUrl,
  listWorkOrderImages,
  uploadWorkOrderImage,
} from '../../services/images.service';
import { formatBytes } from '../../utils/format';

/**
 * Thumbnails + upload (Fase 6). Images are fetched via authenticated blob
 * requests and shown through object URLs — header-based auth cannot be used
 * in plain <img src>.
 */
export function WorkOrderImagesPanel({ workOrderId }: { workOrderId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imagesQuery = useQuery({
    queryKey: ['work-order-images', workOrderId],
    queryFn: () => listWorkOrderImages(workOrderId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadWorkOrderImage(workOrderId, file, caption),
    onSuccess: () => {
      setError(null);
      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: ['work-order-images', workOrderId] });
    },
    onError: (err) => {
      if (err instanceof ApiClientError) {
        if (err.code === 'IMAGE_TOO_LARGE') setError('Arquivo maior que 5 MB.');
        else if (err.code === 'UNSUPPORTED_MEDIA_TYPE')
          setError('Formato não suportado (use JPEG, PNG, WebP ou GIF).');
        else setError(err.message);
      } else {
        setError('Não foi possível enviar a imagem.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => deleteWorkOrderImage(workOrderId, imageId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['work-order-images', workOrderId] });
    },
    onError: () => {
      setError('Não foi possível excluir a imagem.');
    },
  });

  const images: WorkOrderImageDto[] = imagesQuery.data ?? [];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Selecione um arquivo.');
      return;
    }
    uploadMutation.mutate(file);
  }

  function handleDelete(image: WorkOrderImageDto): void {
    if (window.confirm('Excluir esta imagem?')) {
      deleteMutation.mutate(image.id);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Imagens da OS</h2>

      {error ? (
        <div role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form className="mb-4 flex flex-wrap items-center gap-2" onSubmit={handleSubmit}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={caption}
          onChange={(event) => {
            setCaption(event.target.value);
          }}
          placeholder="Legenda (opcional)"
          maxLength={200}
          className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={uploadMutation.isPending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {uploadMutation.isPending ? 'Enviando…' : 'Enviar imagem'}
        </button>
      </form>

      {imagesQuery.isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : images.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma imagem anexada.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="overflow-hidden rounded-md border border-slate-200">
              <AuthenticatedImage workOrderId={workOrderId} imageId={image.id} alt={image.caption ?? 'Imagem da OS'} />
              <div className="border-t border-slate-100 px-2 py-1.5">
                {image.caption ? (
                  <p className="truncate text-xs font-medium text-slate-700" title={image.caption}>
                    {image.caption}
                  </p>
                ) : null}
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    {formatBytes(image.sizeBytes)} · {image.mimeType.replace('image/', '')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(image);
                    }}
                    className="font-medium text-red-500 hover:underline"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Loads bytes with the bearer token and renders an object URL; revokes on unmount. */
function AuthenticatedImage({
  workOrderId,
  imageId,
  alt,
}: {
  workOrderId: string;
  imageId: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchImageObjectUrl(workOrderId, imageId)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [workOrderId, imageId]);

  if (failed) {
    return (
      <div className="flex h-28 items-center justify-center bg-slate-50 text-xs text-slate-400">
        falha ao carregar
      </div>
    );
  }
  return (
    <div className="flex h-28 items-center justify-center bg-slate-50">
      {src ? (
        <img src={src} alt={alt} className="max-h-28 w-full object-contain" />
      ) : (
        <span className="text-xs text-slate-400">carregando…</span>
      )}
    </div>
  );
}
