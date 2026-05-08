import React, { useState } from 'react'
import { definePlugin } from 'sanity'
import { Box, Button, Card, Stack, Text } from '@sanity/ui'

const HOOK_URL = import.meta.env.SANITY_STUDIO_DEPLOY_HOOK_URL as string | undefined

type Estado = 'idle' | 'cargando' | 'ok' | 'error'

function PublicarSitio() {
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensaje, setMensaje] = useState<string | null>(null)

  const handleDeploy = async () => {
    if (!HOOK_URL) {
      setEstado('error')
      setMensaje('No hay un webhook de Netlify configurado.')
      return
    }

    setEstado('cargando')
    setMensaje(null)

    try {
      const res = await fetch(HOOK_URL, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEstado('ok')
      setMensaje('¡Publicación iniciada! El sitio estará actualizado en unos minutos.')
      setTimeout(() => { setEstado('idle'); setMensaje(null) }, 6000)
    } catch (e) {
      setEstado('error')
      setMensaje('No se pudo iniciar la publicación. Intenta nuevamente.')
    }
  }

  return (
    <Box padding={5} style={{ maxWidth: 480 }}>
      <Stack space={4}>
        <Stack space={2}>
          <Text size={3} weight="semibold">Publicar sitio</Text>
          <Text size={1} muted>
            Al hacer clic se generará una nueva versión del sitio con el contenido actual.
          </Text>
        </Stack>

        <Button
          text={estado === 'cargando' ? 'Publicando…' : 'Publicar ahora'}
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
      title: 'Deploy',
      component: PublicarSitio,
    },
  ],
})
