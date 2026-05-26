/**
 * Plugin "Publicar sitio" para Sanity Studio.
 *
 * Flujo:
 *   1. Redactor hace clic en "🚀 Publicar sitio"
 *   2. Studio hace POST a la API de GitHub (repository_dispatch)
 *   3. GitHub Actions corre el workflow deploy.yml
 *   4. El workflow: bun build → wrangler deploy → Worker actualizado
 *
 * Variables necesarias en studio/.env:
 *   SANITY_STUDIO_GITHUB_TOKEN=ghp_xxxx   ← GitHub PAT con scope "repo"
 *   SANITY_STUDIO_GITHUB_OWNER=santinuin
 *   SANITY_STUDIO_GITHUB_REPO=wou-web
 */
import React, { useState } from 'react'
import { definePlugin } from 'sanity'
import { Box, Button, Card, Stack, Text, Flex } from '@sanity/ui'

const GITHUB_TOKEN = import.meta.env.SANITY_STUDIO_GITHUB_TOKEN as string | undefined
const GITHUB_OWNER = (import.meta.env.SANITY_STUDIO_GITHUB_OWNER as string | undefined) ?? 'santinuin'
const GITHUB_REPO  = (import.meta.env.SANITY_STUDIO_GITHUB_REPO as string | undefined) ?? 'wou-web'

const DISPATCH_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/dispatches`

type Estado = 'idle' | 'cargando' | 'ok' | 'error'

function PublicarSitio() {
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [jobUrl, setJobUrl] = useState<string | null>(null)

  const handleDeploy = async () => {
    if (!GITHUB_TOKEN) {
      setEstado('error')
      setMensaje('SANITY_STUDIO_GITHUB_TOKEN no está configurado en studio/.env')
      return
    }

    setEstado('cargando')
    setMensaje(null)
    setJobUrl(null)

    try {
      const res = await fetch(DISPATCH_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'deploy-from-sanity',
          client_payload: {
            triggered_at: new Date().toISOString(),
            triggered_by: 'sanity-studio',
          },
        }),
      })

      // 204 No Content = éxito en GitHub API
      if (res.status === 204) {
        setEstado('ok')
        setMensaje('¡Build iniciado! El sitio estará actualizado en ~3 minutos.')
        setJobUrl(`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`)
        setTimeout(() => { setEstado('idle'); setMensaje(null); setJobUrl(null) }, 15000)
      } else if (res.status === 401) {
        throw new Error('Token inválido. Verificar SANITY_STUDIO_GITHUB_TOKEN en studio/.env')
      } else if (res.status === 404) {
        throw new Error(`Repo no encontrado: ${GITHUB_OWNER}/${GITHUB_REPO}`)
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (e: any) {
      setEstado('error')
      setMensaje(e.message ?? 'Error desconocido. Ver consola del navegador.')
    }
  }

  return (
    <Box padding={5} style={{ maxWidth: 560 }}>
      <Stack space={5}>

        <Stack space={2}>
          <Text size={3} weight="semibold">Publicar sitio</Text>
          <Text size={1} muted>
            Genera una nueva versión del sitio con el contenido publicado en Sanity.
            Las páginas de artículos individuales se actualizan en tiempo real —
            este botón solo es necesario para refrescar la portada.
          </Text>
        </Stack>

        <Card padding={3} radius={2} tone="caution" border>
          <Stack space={2}>
            <Text size={1} weight="semibold">⏱ Tiempo estimado: ~3 minutos</Text>
            <Text size={1} muted>
              El build descarga los artículos de Sanity, genera la portada estática
              y deploya el Worker a Cloudflare.
            </Text>
          </Stack>
        </Card>

        <Button
          text={estado === 'cargando' ? 'Iniciando build…' : '🚀 Publicar ahora'}
          tone="primary"
          onClick={handleDeploy}
          disabled={estado === 'cargando'}
          loading={estado === 'cargando'}
        />

        {mensaje && (
          <Card padding={3} radius={2} tone={estado === 'ok' ? 'positive' : 'critical'} border>
            <Stack space={3}>
              <Text size={1}>{mensaje}</Text>
              {jobUrl && (
                <Text size={1}>
                  <a
                    href={jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    Ver progreso en GitHub Actions →
                  </a>
                </Text>
              )}
            </Stack>
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
