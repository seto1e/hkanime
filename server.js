const express = require('express')
const axios = require('axios')

const app = express()
const BASE = 'https://www.hkanime.com'

let cachedCookie = ''
let cookieExpiry = 0

async function getFreshCookie() {
  try {
    const res = await axios.get(BASE + '/play', {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      maxRedirects: 5
    })
    const setCookie = res.headers['set-cookie']
    if (setCookie) {
      cachedCookie = setCookie.map(c => c.split(';')[0]).join('; ')
      cookieExpiry = Date.now() + 30 * 60 * 1000
      console.log('Got fresh cookie')
    }
  } catch (err) {
    console.error('getFreshCookie error:', err.message)
  }
}

async function fetchJsonApi() {
  if (!cachedCookie || Date.now() > cookieExpiry) {
    await getFreshCookie()
  }
  const res = await axios.get(BASE + '/json-api', {
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Referer': BASE + '/play',
      'Cookie': cachedCookie,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    }
  })
  return res.data
}

async function getList() {
  try {
    const data = await fetchJsonApi()
    const entries = Object.entries(data)
    const list = []
    for (const [key, value] of entries) {
      const items = Array.isArray(value) ? value : []
      if (items.length === 0) continue
      const item = items[0]
      const urlMatch = key.match(/\/(\d+)$/)
      const id = urlMatch ? urlMatch[1] : (item.url ? String(item.url).replace(/\//g, '') : '')
      if (!id || !item.name) continue
      list.push({
        vod_id: id,
        vod_name: item.name,
        vod_pic: item.picslide || '',
        vod_remarks: item.remarks || '',
        vod_play_from: 'hkanime',
        type_id: 4,
        type_name: 'Anime'
      })
    }
    return list
  } catch (err) {
    console.error('getList error:', err.message)
    return []
  }
}

async function getDetail(id) {
  try {
    const data = await fetchJsonApi()
    const entries = Object.entries(data)
    let found = null
    for (const [key, value] of entries) {
      const urlMatch = key.match(/\/(\d+)$/)
      const keyId = urlMatch ? urlMatch[1] : ''
      if (keyId === String(id)) {
        found = { key, items: Array.isArray(value) ? value : [] }
        break
      }
    }
    if (!found || found.items.length === 0) return null
    const item = found.items[0]
    const animeName = item.name || ''

    let playUrls = ''
    try {
      const playRes = await axios.get(BASE + '/play/' + encodeURIComponent(animeName) + '/' + id + 'x0', {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36',
          'Referer': BASE,
          'Cookie': cachedCookie
        }
      })
      const html = playRes.data
      const m3uMatch = html.match(/["']file["']\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/)
      if (m3uMatch) {
        playUrls = 'EP01$' + m3uMatch[1]
      }
    } catch (e) {
      console.error('getDetail play error:', e.message)
    }

    return {
      vod_id: String(id),
      vod_name: animeName,
      vod_pic: item.picslide || '',
      vod_remarks: item.remarks || '',
      vod_content: item.tag || '',
      vod_play_from: 'hkanime',
      vod_play_url: playUrls,
      type_id: 4,
      type_name: 'Anime'
    }
  } catch (err) {
    console.error('getDetail error:', err.message)
    return null
  }
}

async function search(kw) {
  try {
    const list = await getList()
    return list.filter(item => item.vod_name && item.vod_name.includes(kw))
  } catch (err) {
    return []
  }
}

app.get('/api.php/provide/vod/', async (req, res) => {
  const { ac, ids, wd, pg = 1 } = req.query
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  try {
    if (wd) {
      const list = await search(wd)
      return res.json({ code: 1, msg: 'ok', page: 1, pagecount: 1, limit: list.length, total: list.length, list })
    }
    if (ac === 'detail' && ids) {
      const details = []
      for (const id of ids.split(',')) {
        const d = await getDetail(id.trim())
        if (d) details.push(d)
      }
      return res.json({ code: 1, msg: 'ok', page: 1, pagecount: 1, limit: details.length, total: details.length, list: details })
    }
    const list = await getList()
    return res.json({ code: 1, msg: 'ok', page: parseInt(pg), pagecount: 1, limit: list.length, total: list.length, list })
  } catch (err) {
    return res.json({ code: 0, msg: 'error', list: [] })
  }
})

app.get('/', (req, res) => {
  res.send('HKanime API OK')
})

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('Server running on port ' + (process.env.PORT || 3000))
  getFreshCookie()
})
