const express = require(‘express’)
const axios = require(‘axios’)
const cheerio = require(‘cheerio’)

const app = express()
const PORT = process.env.PORT || 3000
const BASE = ‘https://www.hkanime.com’

const http = axios.create({
baseURL: BASE,
timeout: 15000,
headers: {
‘User-Agent’: ‘Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36’,
‘Referer’: BASE
}
})

async function getList() {
try {
const res = await http.get(’/play’)
const $ = cheerio.load(res.data)
const list = []
$(‘a[href*=”/detail/”]’).each((i, el) => {
const href = $(el).attr(‘href’) || ‘’
const name = $(el).find(‘img’).attr(‘alt’) || $(el).text().trim()
const pic = $(el).find(‘img’).attr(‘src’) || ‘’
const remarks = $(el).find(’[class*=“count”]’).text().trim() || ‘’
if (name && href) {
const slug = href.replace(’/detail/’, ‘’).replace(/\/$/, '')
list.push({
vod_id: encodeURIComponent(slug),
vod_name: name,
vod_pic: pic.startsWith(‘http’) ? pic : BASE + pic,
vod_remarks: remarks,
vod_play_from: ‘hkanime’,
type_id: 4,
type_name: ‘Anime’
})
}
})
return list
} catch (err) {
console.error(‘getList error:’, err.message)
return []
}
}

async function getDetail(slug) {
try {
const decoded = decodeURIComponent(slug)
const res = await http.get(’/detail/’ + decoded)
const $ = cheerio.load(res.data)
const name = $(‘h1’).first().text().trim() || decoded
const pic = $(‘img[class*=“cover”]’).first().attr(‘src’) || ‘’
const desc = $(’[class*=“desc”]’).first().text().trim() || ‘’
const episodes = []
$(‘a[href*=”/play/”]’).each((i, el) => {
const href = $(el).attr(‘href’) || ‘’
const epName = $(el).text().trim() || (‘EP’ + (i + 1))
if (href.match(/\/play\/.+\/\d+x\d+/)) {
episodes.push({ href, epName })
}
})
const playUrls = episodes.map(ep => {
const url = ep.href.startsWith(‘http’) ? ep.href : BASE + ep.href
return ep.epName + ‘$’ + url
}).join(’#’)
return {
vod_id: slug,
vod_name: name,
vod_pic: pic.startsWith(‘http’) ? pic : (pic ? BASE + pic : ‘’),
vod_content: desc,
vod_play_from: ‘hkanime’,
vod_play_url: playUrls,
type_id: 4,
type_name: ‘Anime’
}
} catch (err) {
console.error(‘getDetail error:’, err.message)
return null
}
}

async function search(kw) {
try {
const res = await http.get(’/play’, { params: { search: kw } })
const $ = cheerio.load(res.data)
const list = []
$(‘a[href*=”/detail/”]’).each((i, el) => {
const name = $(el).find(‘img’).attr(‘alt’) || $(el).text().trim()
const href = $(el).attr(‘href’) || ‘’
const pic = $(el).find(‘img’).attr(‘src’) || ‘’
const slug = href.replace(’/detail/’, ‘’).replace(//$/, ‘’)
if (name) {
list.push({
vod_id: encodeURIComponent(slug),
vod_name: name,
vod_pic: pic.startsWith(‘http’) ? pic : BASE + pic,
vod_play_from: ‘hkanime’,
type_id: 4,
type_name: ‘Anime’
})
}
})
return list
} catch (err) {
console.error(‘search error:’, err.message)
return []
}
}

app.get(’/api.php/provide/vod/’, async (req, res) => {
const { ac, ids, wd, pg = 1 } = req.query
res.setHeader(‘Content-Type’, ‘application/json; charset=utf-8’)
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’)
try {
if (wd) {
const list = await search(wd)
return res.json({ code: 1, msg: ‘ok’, page: 1, pagecount: 1, limit: list.length, total: list.length, list })
}
if (ac === ‘detail’ && ids) {
const details = []
for (const id of ids.split(’,’)) {
const d = await getDetail(id)
if (d) details.push(d)
}
return res.json({ code: 1, msg: ‘ok’, page: 1, pagecount: 1, limit: details.length, total: details.length, list: details })
}
const list = await getList()
return res.json({ code: 1, msg: ‘ok’, page: parseInt(pg), pagecount: 1, limit: list.length, total: list.length, list })
} catch (err) {
return res.json({ code: 0, msg: ‘error’, list: [] })
}
})

app.get(’/’, (req, res) => {
res.send(‘HKanime API OK’)
})

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
console.log(’Server running on port ’ + PORT)
})