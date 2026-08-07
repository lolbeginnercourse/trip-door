#!/usr/bin/env python3
import json, re, urllib.parse, urllib.request
from html.parser import HTMLParser
from pathlib import Path

OUT=Path('research/generated/network_probe.json')
OUT.parent.mkdir(parents=True,exist_ok=True)
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.cur=None; self.text=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            self.cur=dict(attrs).get('href'); self.text=[]
    def handle_data(self,data):
        if self.cur: self.text.append(data)
    def handle_endtag(self,tag):
        if tag=='a' and self.cur:
            t=' '.join(''.join(self.text).split())
            if t: self.links.append({'href':self.cur,'text':t[:300]})
            self.cur=None; self.text=[]

def get(url,maxbytes=800000):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Language':'ja-JP,ja;q=0.9,en;q=0.7'})
    with urllib.request.urlopen(req,timeout=25) as r:
        b=r.read(maxbytes)
        return r.status,b.decode('utf-8','ignore')

def contexts(text,needle,limit=10):
    out=[]; low=text.lower(); n=needle.lower(); pos=0
    while len(out)<limit:
        i=low.find(n,pos)
        if i<0: break
        out.append(text[max(0,i-250):i+500])
        pos=i+len(n)
    return out

q='スーパーホテル品川 新馬場 最寄り駅 徒歩 公式'
urls={
 'google':'https://www.google.com/search?hl=ja&num=10&q='+urllib.parse.quote(q),
 'yahoo_jp':'https://search.yahoo.co.jp/search?p='+urllib.parse.quote(q),
 'transit_yahoo':'https://transit.yahoo.co.jp/search/result?from='+urllib.parse.quote('新馬場')+'&to='+urllib.parse.quote('天王洲アイル')+'&type=1&ticket=ic',
}
res={}
for name,url in urls.items():
    try:
        status,text=get(url)
        p=LinkParser(); p.feed(text)
        selected=[x for x in p.links if any(k in (x['text']+' '+x['href']).lower() for k in ['スーパー','superhotel','乗換','新馬場','天王洲'])][:30]
        plain=re.sub(r'<[^>]+>',' ',text); plain=' '.join(plain.split())
        matches=re.findall(r'.{0,100}(?:徒歩\s*\d+\s*分|乗換.{0,20}\d+\s*回|\d+\s*分).{0,120}',plain)[:30]
        res[name]={
          'status':status,'length':len(text),'selected_links':selected,'time_matches':matches,
          'superhotel_contexts':contexts(text,'superhotel',8),
          'shinbanba_contexts':contexts(text,'新馬場',8),
          'text_sample':plain[:1000]
        }
    except Exception as e:
        res[name]={'error':repr(e)}
OUT.write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:{'status':v.get('status'),'length':v.get('length'),'links':len(v.get('selected_links',[])),'matches':len(v.get('time_matches',[])),'error':v.get('error')} for k,v in res.items()},ensure_ascii=False))
