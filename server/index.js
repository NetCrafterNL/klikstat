import express from 'express'
import { fileURLToPath } from 'url'
import path from 'path'
import cron from 'node-cron'

import collectHandler from '../api/collect.js'
import statsHandler from '../api/v1/stats.js'
import setupHandler from '../api/v1/setup.js'
import insightsHandler from '../api/ai/insights.js'
import alertsHandler from '../api/alerts/check.js'
import weeklyHandler from '../api/email/weekly.js'
import publicTokenHandler from '../api/public/[token].js'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())

app.all('/api/collect', collectHandler)
app.all('/api/v1/stats', statsHandler)
app.all('/api/v1/setup', setupHandler)
app.all('/api/ai/insights', insightsHandler)
app.all('/api/alerts/check', alertsHandler)
app.all('/api/email/weekly', weeklyHandler)
app.all('/api/public/:token', (req, res) => {
  req.query.token = req.params.token
  return publicTokenHandler(req, res)
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')
app.use(express.static(distDir))
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)

  // Cron jobs (schedules from vercel.json)
  cron.schedule('0 8 * * *', () => fetch(`http://localhost:${PORT}/api/email/weekly?frequency=daily`))
  cron.schedule('0 8 * * 1', () => fetch(`http://localhost:${PORT}/api/email/weekly?frequency=weekly`))
  cron.schedule('0 8 1 * *', () => fetch(`http://localhost:${PORT}/api/email/weekly?frequency=monthly`))
  cron.schedule('0 9 * * *', () => fetch(`http://localhost:${PORT}/api/alerts/check`))
})
