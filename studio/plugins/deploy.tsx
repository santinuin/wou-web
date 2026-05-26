import React, { useState } from 'react'
import { definePlugin } from 'sanity'
import { Box, Button, Card, Stack, Text } from '@sanity/ui'

// Configurar en studio/.env:
//   SANITY_STUDIO_DEPLOY_HOOK_URL=https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/<tu-id>
const HOOK_URL = import.meta.env.SANITY_STUDIO_DEPLOY_HOOK_URL as string | undefined

type Estado = 'idle' | 'cargando' | 'ok' | 'error'

function PublicarSitio() {
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensaje, setMensaje] = useState<string | null>(null)

  const handleDeploy = async () => {
    if (!HOOK_URL) {
      setEstado('error')
      setMensaje('Deploy Hook no configurado. Agregar SANITY_STUDIO_DEPLOY_HOOK_URL en studio/.env')
      return
    }

    setEstado('cargando')
    setMensaje(null)

    try {
      const res = await fetch(HOOK_URL, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEstado('ok')
      setMensaje('¡Build iniciado! El sitio estará actualizado en ~2 minutos.')
      setTimeout(() => { setEstado('idle'); setMensaje(null) }, 8000)
    } catch {
      setEstado('error')
      setMensaje('No se pudo iniciar el build. Verificá la URL del webhook en studio/.env')
    }
  }

  return (
    <Box padding={5} style={{ maxWidth: 520 }}>
      <Stack space={5}>
        <Stack space={2}>
          <Text size={3} weight="semibold">Publicar sitio</Text>
          <Text size={1} muted>
            Dispara un nuevo build en Cloudflare Pages con el contenido actual de Sanity.
            Úsalo después de publicar artículos importantes o cambios en portada.
          </Text>
        </Stack>

        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>
            ⚡ El build tarda ~2 minutos. Las páginas de artículo individuales
            siempre están actualizadas en tiempo real — el rebuild solo afecta la portada.
          </Text>
        </Card>

        <Button
          text={estado === 'cargando' ? 'Iniciando build…' : '🚀 Publicar ahora'}
          tone="primary"
          onClick={handleDeploy}
          disabled={estado === 'cargando'}
          loading={estado === 'cargando'}
        />

        {mensaje && (
          <Card
            padding={3}
            radius={2}
            tone={estado === 'ok' ? 'positive' : 'critical'}
          >
            <Text size={1}>{mensaje}</Text>
          </Card>
        )}
      </Stack>
    </Box>
  )
}

export const deployPlugin = definePlugin({
  name: 'deploy',
  tools: [
    {
      name: 'deploy',
      title: '🚀 Publicar sitio',
      component: PublicarSitio,
    },
  ],
})
