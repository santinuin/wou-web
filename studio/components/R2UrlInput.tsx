/**
 * R2UrlInput — input personalizado para los campos `url` en `r2Image` y `mainImage`.
 *
 * Flujo para el redactor:
 *   1. Arrastra o selecciona una imagen → se sube automáticamente al Worker /api/upload-image.
 *   2. El Worker la escribe en R2 y devuelve la URL pública.
 *   3. El campo `url` se rellena solo y aparece un preview.
 *   4. El redactor solo necesita completar el campo `alt`.
 *
 * Variables de entorno en studio/.env:
 *   SANITY_STUDIO_UPLOAD_URL    → https://wou.com.ar/api/upload-image
 *   SANITY_STUDIO_UPLOAD_SECRET → token compartido con el Worker (openssl rand -hex 32)
 */
import React, { useCallback, useRef, useState } from 'react'
import { set, unset } from 'sanity'
import type { StringInputProps } from 'sanity'
import { Box, Button, Card, Flex, Spinner, Stack, Text, TextInput } from '@sanity/ui'
import { UploadIcon } from '@sanity/icons'

const UPLOAD_URL    = import.meta.env.SANITY_STUDIO_UPLOAD_URL    as string | undefined
const UPLOAD_SECRET = import.meta.env.SANITY_STUDIO_UPLOAD_SECRET as string | undefined

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

/** Lee dimensiones reales de una imagen dada su URL (necesita que el origen permita CORS). */
function readImageDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export function R2UrlInput(props: StringInputProps) {
  const { value, onChange, readOnly, elementProps } = props

  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(value ?? null)
  const [dragging, setDragging]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Subir archivo al Worker ─────────────────────────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (!UPLOAD_URL || !UPLOAD_SECRET) {
      setErrorMsg(
        'SANITY_STUDIO_UPLOAD_URL o SANITY_STUDIO_UPLOAD_SECRET no configurados en studio/.env'
      )
      setUploadState('error')
      return
    }

    setUploadState('uploading')
    setErrorMsg(null)
    setPreviewUrl(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPLOAD_SECRET}` },
        body: form,
      })

      const json = await res.json() as { url?: string; error?: string }

      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      if (!json.url) throw new Error('El servidor no devolvió una URL')

      // Actualizar campo `url` en el documento Sanity
      onChange(set(json.url))
      setPreviewUrl(json.url)
      setUploadState('done')

      // Intentar leer dimensiones en background (no bloquea al redactor)
      readImageDimensions(json.url).then((dims) => {
        if (dims && props.elementProps) {
          // Si el componente padre expone un onFocus/onChange a nivel objeto,
          // podremos patchear width/height. Por ahora las dimensiones se pueden
          // ingresar manualmente — se llenan en la migración automática.
          // TODO: usar FormPatch si el parent lo expone via context en futuras versiones.
        }
      })
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Error desconocido')
      setUploadState('error')
    }
  }, [onChange])

  // ── Handlers de UI ──────────────────────────────────────────────────────────
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = '' // permite re-seleccionar el mismo archivo
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim()
    onChange(v ? set(v) : unset())
    setPreviewUrl(v || null)
    setUploadState('idle')
    setErrorMsg(null)
  }

  const handleClear = () => {
    onChange(unset())
    setPreviewUrl(null)
    setUploadState('idle')
    setErrorMsg(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Stack space={3}>

      {/* Zona de drag-and-drop */}
      <Card
        padding={4}
        radius={2}
        border
        tone={
          dragging       ? 'primary'  :
          uploadState === 'error' ? 'critical' :
          uploadState === 'done'  ? 'positive' : 'default'
        }
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{ borderStyle: 'dashed', cursor: readOnly ? 'default' : 'pointer' }}
        onClick={() => !readOnly && inputRef.current?.click()}
      >
        <Flex align="center" justify="center" gap={3} direction="column">
          {uploadState === 'uploading' ? (
            <>
              <Spinner muted />
              <Text size={1} muted>Subiendo imagen a R2…</Text>
            </>
          ) : (
            <>
              <UploadIcon style={{ width: 28, height: 28, opacity: 0.45 }} />
              <Text size={1} muted align="center">
                {dragging
                  ? '↓ Suelta la imagen aquí'
                  : 'Arrastrá una imagen o hacé clic para seleccionar'}
              </Text>
              <Text size={0} muted>JPG · PNG · WebP · GIF · AVIF · SVG</Text>
            </>
          )}
        </Flex>
      </Card>

      {/* Input file oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
        disabled={!!readOnly}
      />

      {/* Error */}
      {uploadState === 'error' && errorMsg && (
        <Card padding={3} radius={2} tone="critical" border>
          <Text size={1}>⚠ {errorMsg}</Text>
        </Card>
      )}

      {/* Preview de la imagen ya subida */}
      {previewUrl && uploadState !== 'uploading' && (
        <Card padding={2} radius={2} border>
          <Stack space={2}>
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: 220,
                objectFit: 'contain',
                borderRadius: 4,
                display: 'block',
                margin: '0 auto',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            {uploadState === 'done' && (
              <Text size={0} muted style={{ wordBreak: 'break-all', textAlign: 'center' }}>
                ✓ Imagen subida correctamente
              </Text>
            )}
          </Stack>
        </Card>
      )}

      {/* Campo URL manual (fallback / edición directa) */}
      <Stack space={1}>
        <Text size={1} muted weight="semibold">URL directa</Text>
        <Flex gap={2} align="center">
          <Box flex={1}>
            <TextInput
              {...elementProps}
              value={value ?? ''}
              onChange={handleUrlChange}
              placeholder="https://media.wou.com.ar/uploads/2025/01/…"
              readOnly={!!readOnly}
            />
          </Box>
          {value && !readOnly && (
            <Button
              mode="ghost"
              tone="critical"
              text="Limpiar"
              onClick={handleClear}
            />
          )}
        </Flex>
      </Stack>

    </Stack>
  )
}
