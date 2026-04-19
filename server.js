// ============================================================
// HKanime → T4 API Proxy Server
// 供 JSTV 等播放器使⽤嘅苹果CMS T4 格式 API
// ============================================================
const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const app = express()
const PORT = process.env.PORT || 3000
const BASE_URL = 'https://www.hkanime.com'
// 設定 axios 預設 headers，模擬瀏覽器避免被封
const http = axios.create({
 baseURL: BASE_URL,
 timeout: 15000,
 headers: {
 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0. 'Referer': BASE_URL
 }
})
// ============================================================
// ⼯具函數：爬取動畫列表⾴
// ============================================================
async function fetchAnimeList(page = 1) {
 try {
 const res = await http.get('/play')
 const $ = cheerio.load(res.data)
 const list = []
 // 每個動畫卡片
 $('a[href*="/detail/"]').each((i, el) => {
 const href = $(el).attr('href') || ''
 const name = $(el).find('img').attr('alt') || $(el).text().trim()
 const pic = $(el).find('img').attr('src') || ''
 const remarks = $(el).find('.badge, .ep-count, [class*="count"]').text().trim() || ''
 if (name && href) {
 // 從 URL 抽取動畫 slug，例如 /detail/銀魂 → 銀魂
 const slug = href.replace('/detail/', '').replace(/\/$/, '')
 list.push({
 vod_id: encodeURIComponent(slug),
 vod_name: name,
 vod_pic: pic.startsWith('http') ? pic : BASE_URL + pic,
 vod_remarks: remarks,
 vod_play_from: 'hkanime',
 type_id: 4, // 動漫分類
 type_name: '動漫'
 })
 }
 })
 return list
 } catch (err) {
 console.error('fetchAnimeList error:', err.message)
 return []
 }
}
// ============================================================
// ⼯具函數：爬取動畫詳情⾴，取得集數列表
// ============================================================
async function fetchAnimeDetail(slug) {
 try {
 const decodedSlug = decodeURIComponent(slug)
 const res = await http.get(`/detail/${decodedSlug}`)
 const $ = cheerio.load(res.data)
 // 動畫名稱
 const name = $('h1, .anime-title, [class*="title"]').first().text().trim() || decodedSlug
 // 封⾯圖片
 const pic = $('img[class*="cover"], img[class*="poster"], .anime-cover img').first().attr // 簡介
 const desc = $('[class*="desc"], [class*="synopsis"], .intro').first().text().trim() || ' // 集數連結：搵所有 /play/動畫名/季x集 格式嘅連結
 const episodes = []
 $(`a[href*="/play/${encodeURIComponent(decodedSlug)}/"], a[href*="/play/${decodedSlug}/"] const href = $(el).attr('href') || ''
 const epName = $(el).text().trim() || `第${i + 1}集`
 if (href.match(/\/play\/.+\/\d+x\d+/)) {
 episodes.push({ href, epName })
 }
 })
 // 將集數轉換成 T4 格式播放連結字串
 // 格式：第1集$URL#第2集$URL#...
 const playUrls = episodes.map(ep => {
 const playUrl = ep.href.startsWith('http') ? ep.href : BASE_URL + ep.href
 return `${ep.epName}$${playUrl}`
 }).join('#')
 return {
 vod_id: slug,
 vod_name: name,
 vod_pic: pic.startsWith('http') ? pic : (pic ? BASE_URL + pic : ''),
 vod_content: desc,
 vod_play_from: 'hkanime',
 vod_play_url: playUrls,
 type_id: 4,
 type_name: '動漫'
 }
 } catch (err) {
 console.error('fetchAnimeDetail error:', err.message)
 return null
 }
}
// ============================================================
// ⼯具函數：搜尋動畫
// ============================================================
async function searchAnime(keyword) {
 try {
 const res = await http.get('/play', {
 params: { search: keyword }
 })
 const $ = cheerio.load(res.data)
 const list = []
 $('a[href*="/detail/"]').each((i, el) => {
 const name = $(el).find('img').attr('alt') || $(el).text().trim()
 if (name && name.includes(keyword)) {
 const href = $(el).attr('href') || ''
 const pic = $(el).find('img').attr('src') || ''
 const slug = href.replace('/detail/', '').replace(/\/$/, '')
 list.push({
 vod_id: encodeURIComponent(slug),
 vod_name: name,
 vod_pic: pic.startsWith('http') ? pic : BASE_URL + pic,
 vod_play_from: 'hkanime',
 type_id: 4,
 type_name: '動漫'
 })
 }
 })
 return list
 } catch (err) {
 console.error('searchAnime error:', err.message)
 return []
 }
}
// ============================================================
// 主要 API 路由（T4 標準格式）
// JSTV 會呼叫：
// ?ac=list → 列表
// ?ac=detail&ids=X → 詳情
// ?wd=關鍵字 → 搜尋
// ============================================================
app.get('/api.php/provide/vod/', async (req, res) => {
 const { ac, ids, wd, pg = 1 } = req.query
 res.setHeader('Content-Type', 'application/json; charset=utf-8')
 res.setHeader('Access-Control-Allow-Origin', '*')
 try {
 // ---------- 搜尋 ----------
 if (wd) {
 const list = await searchAnime(wd)
 return res.json({
 code: 1,
 msg: '搜尋結果',
 page: 1,
 pagecount: 1,
 limit: list.length,
 total: list.length,
 list
 })
 }
 // ---------- 詳情 ----------
 if (ac === 'detail' && ids) {
 const idList = ids.split(',')
 const details = []
 for (const id of idList) {
 const detail = await fetchAnimeDetail(id)
 if (detail) details.push(detail)
 }
 return res.json({
 code: 1,
 msg: '影片詳情',
 page: 1,
 pagecount: 1,
 limit: details.length,
 total: details.length,
 list: details
 })
 }
 // ---------- 列表（預設）----------
 if (ac === 'list' || !ac) {
 const list = await fetchAnimeList(pg)
 return res.json({
 code: 1,
 msg: '數據列表',
 page: parseInt(pg),
 pagecount: 1,
 limit: list.length,
 total: list.length,
 list
 })
 }
 // 未知請求
 return res.json({ code: 0, msg: '無效請求', list: [] })
 } catch (err) {
 console.error('API error:', err.message)
 return res.json({ code: 0, msg: '伺服器錯誤', list: [] })
 }
})
// 根路徑健康檢查（Render 需要）
app.get('/', (req, res) => {
 res.send('HKanime T4 API 運⾏中 ')
})
app.listen(PORT, () => {
 console.log(` HKanime API 已啟動：http://localhost:${PORT}`)
 console.log(` T4 端點：http://localhost:${PORT}/api.php/provide/vod/`)
})
