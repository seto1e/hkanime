const express = require('express')
const axios = require('axios')

const app = express()
const BASE = 'https://www.hkanime.com'

const http = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': BASE
  }
})

async function getList() {
  try {
    const res = await http.get(BASE + '/json-api')
    const data = res.data
    const items = Array.isArray(data) ? data : (data.list || data.data || [])
    return items.map((item, i) => ({
      vod_id: String(item.url || item.id || i).replace(/\//g, ''),
      vod_name: item.name || '',
      vod_pic: item.picslide || item.pic || '',
      vod_remarks: item.remarks || '',
      vod_play_from: 'hkanime',
      type_id: 4,
      type_name: 'Anime'
    }))
  } catch (err) {
    console.error('getList error:', err.message)
    return []
  }
}

async function getDetail(id) {
  try {
    const res = await http.get(BASE + '/json-api?id=' + id)
    const data = res.data
    const item = Array.isArray(data) ? data[0] : (data.info || data)
    if (!item) return null

    const episodes = item.episodes || item.eps || item.list || []
    let playUrls = ''

    if (Array.isArray(episodes) && episodes.length > 0) {
      playUrls = episodes.map((ep, i) => {
        const epName = ep.name || ep.title || ('EP' + (i + 1))
        const epUrl = ep.url || ep.link || ''
        const fullUrl = epUrl.startsWith('http') ? epUrl : BASE + epUrl
        return epName + '$' + fullUrl
      }).join('#')
    } else {
      const pageRes = await http.get(BASE + '/play/' + (item.name || id) + '/' + id + 'x0')
      const html = pageRes.data
      const m3uMatch = html.match(/file["'\s]*:["'\s]*(https?:\/\/[^"']+\.m3u8[^"']*)/)
      if (m3uMatch) {
        playUrls = 'EP01$' + m3uMatch[1]
      }
    }

    return {
      vod_id: String(id),
      vod_name: item.name || '',
      vod_pic: item.picslide || item.pic || '',
      vod_content: item.desc || item.intro || '',
      vod_remarks: item.remarks || '',
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
    return list.filter(item =>
      item.vod_name && item.vod_name.includes(kw)
    )
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
})
