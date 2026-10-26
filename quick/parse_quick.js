/**
 * 한 줄 글 → 일정 칸 분석 (사이트 퀵 등록의 parseQuick 과 같은 규칙).
 * 사이트 서버(Parse.gs) · PC 단축키 창 · 아이폰 위젯이 이 파일 하나를 같이 쓴다. 고치면 build.py 를 다시 돌릴 것.
 * opts: { me: '내 이름', people: ['조직원', ...], today: 'YYYY-MM-DD' }
 * 반환: { date, timeStart, timeEnd, people[], place, link, title, note, hasDate }
 */
function hqParseQuick(raw, opts) {
  opts = opts || {};
  var DAY = 864e5;
  var toN = function (s) { var p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]) / DAY; };
  var fd = function (n) { return new Date(n * DAY); };
  var dow = function (n) { return (fd(n).getUTCDay() + 6) % 7; };
  var iso = function (n) { return fd(n).toISOString().slice(0, 10); };
  var PEOPLE = (opts.people || []).filter(Boolean).slice().sort(function (a, b) { return b.length - a.length; });
  var today = toN(opts.today || iso(Math.floor(Date.now() / DAY)));
  var t = String(raw || '').replace(/<@[A-Z0-9]+\|([^>]*)>/g, ' @$1 ').replace(/<@[A-Z0-9]+>/g, ' ').replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2 $1').replace(/[​\r]/g, '');
  var out = { date: '', timeStart: '', timeEnd: '', people: [], place: '', link: '', title: '', note: '', hasDate: false };
  var cut = function (re) { var m = t.match(re); if (m) t = t.replace(m[0], ' '); return m; };
  var lk = cut(/https?:[^\s)]+/); if (lk) out.link = lk[0];
  var setD = function (n) { out.date = iso(n); out.hasDate = true; };
  var m;
  if ((m = cut(/(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})일?/))) setD(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY);
  else if ((m = cut(/(\d{1,2})\s*(?:\/|\.|월)\s*(\d{1,2})\s*일?/))) { var y = fd(today).getUTCFullYear(); var n = Date.UTC(y, +m[1] - 1, +m[2]) / DAY; if (n < today - 60) n = Date.UTC(y + 1, +m[1] - 1, +m[2]) / DAY; setD(n); }
  else if ((m = cut(/(오늘|금일|내일|명일|모레|글피)/))) setD(today + { 오늘: 0, 금일: 0, 내일: 1, 명일: 1, 모레: 2, 글피: 3 }[m[1]]);
  else if ((m = cut(/(다음\s*주|담주|차주|이번\s*주|금주)?\s*([월화수목금토일])요일/))) { var k = '월화수목금토일'.indexOf(m[2]), base = today - dow(today); var n2 = base + k + (m[1] && /다음|담|차/.test(m[1]) ? 7 : 0); if (!m[1] && n2 < today) n2 += 7; setD(n2); }
  else if ((m = cut(/(\d{1,2})일(?!\s*(?:간|동안|째))/))) { var d = fd(today); var n3 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), +m[1]) / DAY; if (n3 < today) n3 = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, +m[1]) / DAY; setD(n3); }
  var tm = [], TR = /(오전|오후|아침|저녁|밤)?\s*(\d{1,2})\s*(?::\s*(\d{2})|시\s*(반|(\d{1,2})\s*분)?)/;
  for (var i = 0; i < 2; i++) {
    var x = cut(TR); if (!x) break;
    var h = +x[2], mi = x[3] ? +x[3] : x[4] === '반' ? 30 : x[5] ? +x[5] : 0, ap = x[1] || (i && tm[0] && tm[0].pm ? '오후' : '');
    if (/오후|저녁|밤/.test(ap) && h < 12) h += 12; else if (!ap && h >= 1 && h <= 7) h += 12; /* 1~7시는 오후로 봄 (업무 시간) */
    if (h > 23 || mi > 59) continue;
    tm.push({ hm: String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0'), pm: h >= 12 });
    t = t.replace(/^\s*[~\-–]\s*/, ' ');
  }
  if (tm[0]) out.timeStart = tm[0].hm; if (tm[1] && tm[1].hm > tm[0].hm) out.timeEnd = tm[1].hm;
  if ((m = t.match(/(전원|모두|다\s?같이|본부\s?전체)/))) { out.people = PEOPLE.slice(); t = t.replace(m[0], ' '); }
  var found = [];
  PEOPLE.forEach(function (nm) { var re = new RegExp('@?' + nm + '\\s*(님|팀장님|팀장|실장님|실장|이사님|책임님)?', 'g'), at = t.search(re); if (at >= 0) { found.push([at, nm]); t = t.replace(re, ' '); } });
  found.sort(function (p, q) { return p[0] - q[0]; }).forEach(function (f) { if (out.people.indexOf(f[1]) < 0) out.people.push(f[1]); }); /* 글에 적힌 순서대로 */
  if ((m = cut(/((?:\d+\s*층\s*)?\S*회의실|\S*룸|줌|zoom|ZOOM|구글\s*밋|google\s*meet|화상|모스키토|크리켓|레이디버그|시케이더|범블비|드래곤|플라이)(?:으로|로|에서)?/))) out.place = m[1];
  var lines = t.split('\n').map(function (l) { return l.replace(/[@,·|]+/g, ' ').replace(/\s+/g, ' ').replace(/^(에|에서|부터|까지|에는|은|는|로|으로|와|과|랑)\s+/, '').trim(); }).filter(function (l) { return l && !/^[~\-–:.()\[\]]+$/.test(l); });
  out.title = (lines[0] || '').replace(/^(\[|\()?(공지|알림|안내)(\]|\))?\s*/, '').replace(/\s*(입니다|있습니다|진행합니다|하겠습니다|해요|예정|부탁드려요|부탁드립니다|부탁해요|드려요|할게요|합시다|해주세요)[.!~]*$/, '').replace(/^(에|에서)\s+/, '').trim().slice(0, 60);
  out.note = lines.slice(1).join('\n').slice(0, 300);
  out.people = out.people.filter(function (nm) { return nm !== opts.me; });
  if (!out.date) out.date = iso(today);
  return out;
}
if (typeof module !== 'undefined') module.exports = { hqParseQuick: hqParseQuick };
