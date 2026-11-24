const chartParents = {
  111: 'Tiền mặt',
  112: 'Tiền gửi ngân hàng',
  133: 'Thuế GTGT được khấu trừ',
  138: 'Phải thu khác',
  211: 'Tài sản cố định',
  214: 'Hao mòn TSCĐ',
  333: 'Thuế và các khoản phải nộp Nhà nước',
  3331: 'Thuế GTGT phải nộp',
  338: 'Phải trả, phải nộp khác',
  341: 'Vay và nợ thuê tài chính',
  421: 'Lợi nhuận sau thuế chưa phân phối',
  511: 'Doanh thu bán hàng và cung cấp dịch vụ',
  642: 'Chi phí quản lý kinh doanh',
};
const chartAccounts = [
  ...Object.entries(chartParents).map(([code, name]) => ({
    code,
    name,
    parent: code === '3331' ? '333' : '',
    active: true,
  })),
  ...accounts.map((value) => {
    const [code, name] = value.split(' · ');
    const parent =
      Object.keys(chartParents)
        .sort((a, b) => b.length - a.length)
        .find((candidate) => code !== candidate && code.startsWith(candidate)) || '';
    return {
      code,
      name,
      parent,
      active: true,
      defaultUse: ['1111', '1121'].includes(code),
      party: code === '131' ? 'Khách hàng' : code === '331' ? 'Nhà cung cấp' : '',
    };
  }),
  { code: '5113', name: 'Doanh thu cung cấp dịch vụ', parent: '511', active: true },
  { code: '64221', name: 'Chi phí văn phòng xưởng cũ', parent: '6422', active: false },
];
accounts.push(
  ...chartAccounts
    .filter((x) => !accounts.some((a) => accountCode(a) === x.code))
    .map((x) => x.code + ' · ' + x.name),
);

const chartHtml = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hệ thống tài khoản · Mini ERP Xưởng gỗ</title>
<style>
:root{font:14px system-ui,sans-serif;color:#17263d;background:#f5f7fa;--line:#dfe5ee;--muted:#576984;--blue:#474eff}
*{box-sizing:border-box}body{margin:0}button,input,select,textarea{font:inherit}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #a7b5ff;outline-offset:2px}
.shell{display:grid;grid-template-columns:218px minmax(0,1fr);min-height:100vh}.sidebar,.top,article,dialog{background:white}.sidebar{border-right:1px solid var(--line);padding:16px 10px}.brand{display:flex;align-items:center;gap:10px;margin:0 2px 30px}.logo,.avatar{display:grid;place-items:center;background:var(--blue);color:white;width:34px;height:34px;border-radius:9px;font-weight:750}.brand small,.person small{display:block;color:var(--muted)}.nav{color:#344562;padding:9px 12px;margin:2px 0;border-radius:7px}.nav.active{background:#eaf0ff;color:#303bd1;font-weight:650}.navtitle{font-size:11px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin:20px 10px 6px}.top{height:57px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 25px}.person{display:flex;align-items:center;gap:9px}.avatar{border-radius:50%;width:30px;height:30px}
main{max-width:1450px;margin:auto;padding:28px 36px}.crumb,.muted{color:var(--muted)}.crumb{font-size:13px}h1{font-size:29px;letter-spacing:-.035em;margin:7px 0 5px}h2{font-size:17px;margin:0}p{line-height:1.5;margin:0}.pagehead,.toolbar,.section,.actions,.summary{display:flex;align-items:center;gap:10px}.pagehead,.section,.summary{justify-content:space-between}.pagehead{margin-bottom:22px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}article,dialog{border:1px solid var(--line);border-radius:12px}article{min-width:0;overflow:hidden}.section,.toolbar,.summary{padding:14px 16px}.toolbar{padding-top:0;flex-wrap:wrap}.toolbar input{flex:1;min-width:165px}button,input,select,textarea{border:1px solid #ccd5e2;border-radius:6px;padding:8px 10px;background:white;color:inherit}button.primary{background:var(--blue);border-color:var(--blue);color:white;font-weight:650}button.link{color:#3341db;border:0;background:transparent;text-align:left;padding:4px; font-weight:650}button.ghost{border:0;background:transparent;padding:3px 6px}button.danger{background:#b72432;color:white;border-color:#b72432}button.warn{color:#a52230}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{padding:11px 12px;border-top:1px solid #edf0f5;text-align:left}th{background:#fafbfd;color:var(--muted);font-size:12px}tr.selected{background:#eef3ff}tr:hover td{background:#f5f7ff}.account{display:flex;align-items:center;gap:6px}.indent{padding-left:20px}.spacer{display:inline-block;width:23px}.account button{min-width:22px}.pill{display:inline-block;border-radius:999px;padding:4px 8px;font-size:12px;background:#e7f8ee;color:#146442}.pill.off{background:#edf0f4;color:#4b5a6d}.summary{border-top:1px solid var(--line);font-size:12px}.detail{padding:17px}.detail h2{margin:9px 0}.detail .code{font:650 13px ui-monospace,monospace;color:#3041c9}.detail dl{margin:18px 0}.detail dl div{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #edf0f5}.detail dt{color:var(--muted)}.detail dd{margin:0;text-align:right}.detail .actions{flex-wrap:wrap;margin-top:16px}.note{padding:10px 12px;background:#f4f6fb;border-radius:7px;font-size:13px;color:#46536a}.empty{text-align:center;padding:32px;color:var(--muted)}dialog{width:min(510px,calc(100vw - 25px));padding:0;color:inherit;box-shadow:0 18px 65px #18294e33}dialog::backdrop{background:#17243c65}dialog header,dialog footer{padding:15px 20px;display:flex;align-items:center;justify-content:space-between;gap:8px}dialog header{border-bottom:1px solid var(--line)}dialog footer{justify-content:flex-end;border-top:1px solid var(--line)}.body{padding:18px 20px;display:grid;gap:12px}.body label{display:grid;gap:5px;font-weight:600}.body input,.body select,.body textarea{width:100%;font-weight:400}.fields{display:grid;grid-template-columns:1fr 2fr;gap:12px}.err{color:#a52230}.notice{margin-bottom:14px;color:#12523b;background:#e8f8ef;border-radius:7px;padding:10px 14px}.notice:empty{display:none}
@media(max-width:1180px){main{padding:23px}.layout{grid-template-columns:minmax(0,1fr)}.detail{max-width:none}}@media(max-width:730px){.shell{display:block}.sidebar{display:none}.top{padding:0 14px}main{padding:16px}.pagehead{flex-wrap:wrap}.fields{grid-template-columns:1fr}}
.shell{display:block}.sidebar,.top,.pagehead>div{display:none}main{padding:12px}.layout{grid-template-columns:minmax(0,1fr) 270px}@media(max-width:750px){.layout{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="shell">
<aside class="sidebar" aria-label="Các nhóm màn hình Mini ERP">
<div class="brand"><span class="logo">G</span><div><b>Mini ERP</b><small>Xưởng gỗ</small></div></div>
<div class="nav">Tổng quan</div><div class="navtitle">Danh mục</div><div class="nav">Hàng hóa</div><div class="nav">Kho</div><div class="nav">Nhà cung cấp</div><div class="nav">Khách hàng</div>
<div class="navtitle">Mua hàng</div><div class="nav">Đơn mua</div><div class="nav">Phiếu nhập kho</div><div class="nav">Hóa đơn mua</div>
<div class="navtitle">Bán hàng</div><div class="nav">Đơn bán</div><div class="nav">Phiếu giao hàng</div><div class="nav">Hóa đơn bán</div>
<div class="navtitle">Kế toán</div><div class="nav">Bút toán</div><div class="nav">Thanh toán</div><div class="nav">Công nợ</div><div class="nav active" aria-current="page">Hệ thống tài khoản</div>
</aside>
<div>
<header class="top"><b>Mini ERP Xưởng gỗ</b><div class="person"><span class="avatar">K</span><div><b>Kế toán</b><small>Bản mẫu giao diện</small></div></div></header>
<main>
<div class="pagehead"><div><div class="crumb">Kế toán / Hệ thống tài khoản</div><h1>Hệ thống tài khoản</h1><p class="muted">Tra cứu và quản lý tài khoản kế toán theo Thông tư 133.</p></div><button class="primary" id="add">+ Thêm tài khoản chi tiết</button></div>
<div id="notice" class="notice" role="status"></div>
<div class="layout">
<article>
<div class="section"><h2>Danh mục tài khoản</h2><button id="toggle" class="link">Thu gọn tất cả</button></div>
<div class="toolbar"><input id="search" type="search" aria-label="Tìm tài khoản" placeholder="Tìm theo mã hoặc tên tài khoản"><select id="status" aria-label="Trạng thái"><option value="">Mọi trạng thái</option><option value="on">Đang sử dụng</option><option value="off">Ngừng sử dụng</option></select></div>
<div class="scroll"><table><thead><tr><th>Mã TK</th><th>Tên tài khoản</th><th>Loại</th><th>Trạng thái</th></tr></thead><tbody id="rows"></tbody></table></div>
<div class="summary"><span id="count"></span><span class="muted">Dữ liệu mẫu</span></div>
</article>
<article id="detail" class="detail" aria-label="Chi tiết tài khoản"></article>
</div>
</main></div></div>
<dialog id="modal" aria-labelledby="modalTitle"><form id="form"><header><h2 id="modalTitle"></h2><button type="button" id="close" class="ghost" aria-label="Đóng">✕</button></header><div class="body" id="modalBody"></div><footer><button type="button" id="cancel">Quay lại</button><button id="confirm" class="primary"></button></footer></form></dialog>
<script>
const byId = id => document.getElementById(id);
const make = (code,name,parent='',options={}) => ({code,name,parent,active:true,...options});
const accounts = __ERP_CHART_DATA__;
let selected = '1121';
let mode = '';
const collapsed = new Set();
const children = code => accounts.filter(a => a.parent === code);
const get = code => accounts.find(a => a.code === code);
const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/đ/g,'d');
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pill = a => '<span class="pill '+(a.active?'':'off')+'">'+(a.active?'Đang sử dụng':'Ngừng sử dụng')+'</span>';
const parents = () => accounts.filter(a => children(a.code).length);
const addable = a => a.active && !a.balance && !a.defaultUse;
function render(){
 const term=normalize(byId('search').value.trim());
 const filter=byId('status').value;
 const filtered=Boolean(term||filter);
 const match=a=>normalize(a.code+' '+a.name).includes(term)&&(!filter||filter===(a.active?'on':'off'));
 const visible=[];
 function walk(parent,depth){
  for(const a of children(parent).sort((x,y)=>x.code.localeCompare(y.code))){
   if(!filtered||match(a)) visible.push({a,depth});
   if(filtered||!collapsed.has(a.code)) walk(a.code,depth+1);
  }
 }
 walk('',0);
 byId('toggle').disabled=filtered;
 byId('toggle').textContent=collapsed.size?'Mở rộng tất cả':'Thu gọn tất cả';
 byId('count').textContent='Hiển thị '+visible.length+' tài khoản';
 byId('rows').innerHTML=visible.map(({a,depth})=>{
  const group=children(a.code).length>0;
  const expand=group&&!filtered?'<button class="ghost" data-tree="'+a.code+'" aria-expanded="'+!collapsed.has(a.code)+'" aria-label="Mở hoặc thu gọn '+a.code+'">'+(collapsed.has(a.code)?'▸':'▾')+'</button>':'<span class="spacer"></span>';
  return '<tr class="'+(selected===a.code?'selected':'')+'"><td><div class="account" style="padding-left:'+depth*17+'px">'+expand+'<button class="link" data-code="'+a.code+'">'+a.code+'</button></div></td><td>'+escape(a.name)+'</td><td>'+(group?'Tổng hợp':'Ghi sổ')+'</td><td>'+pill(a)+'</td></tr>';
 }).join('')||'<tr><td class="empty" colspan="4">Không tìm thấy tài khoản phù hợp.</td></tr>';
 renderDetail();
}
function renderDetail(){
 const a=get(selected);
 const group=children(a.code).length>0;
 byId('detail').innerHTML='<div class="code">TK '+a.code+'</div><h2>'+escape(a.name)+'</h2>'+pill(a)+
 '<dl><div><dt>Tài khoản cha</dt><dd>'+(a.parent?'<button class="link" data-code="'+a.parent+'">'+a.parent+'</button>':'—')+
 '</dd></div><div><dt>Loại tài khoản</dt><dd>'+(group?'Tổng hợp':'Ghi sổ')+'</dd></div><div><dt>Theo dõi đối tượng</dt><dd>'+(a.party||'—')+
 '</dd></div><div><dt>Tài khoản con</dt><dd>'+children(a.code).length+'</dd></div></dl>'+
 (a.defaultUse?'<p class="note">Tài khoản đang được dùng mặc định trong cấu hình kế toán.</p>':'')+
 '<div class="actions">'+(addable(a)?'<button data-action="add">Thêm TK con</button>':'')+
 '<button class="link" data-action="ledger">Xem sổ cái</button>'+
 (a.active?'<button class="warn" data-action="disable">Ngừng sử dụng</button>':'<button data-action="enable">Dùng lại</button>')+'</div>';
}
function openDialog(action){
 mode=action;
 const a=get(selected);
 const body=byId('modalBody');
 const confirm=byId('confirm');
 confirm.disabled=false;
 confirm.className='primary';
 if(action==='add'){
  const choices=accounts.filter(addable);
  byId('modalTitle').textContent='Thêm tài khoản chi tiết';
  body.innerHTML='<label>Tài khoản cha<select id="parent" required><option value="">Chọn tài khoản cha</option>'+choices.map(item=>'<option value="'+item.code+'">'+item.code+' · '+escape(item.name)+'</option>').join('')+'</select></label><div class="fields"><label>Mã tài khoản<input id="code" required inputmode="numeric" pattern="[0-9]+" maxlength="16"></label><label>Tên tài khoản<input id="name" required maxlength="100"></label></div><label>Theo dõi đối tượng<select id="party"><option value="">Không theo dõi</option><option>Khách hàng</option><option>Nhà cung cấp</option></select></label><p class="note">Mã chi tiết bắt đầu bằng mã cha và phải duy nhất.</p><p id="error" class="err" role="alert"></p>';
  byId('parent').value=addable(a)?a.code:'';
  confirm.textContent='Lưu tài khoản';
 } else if(action==='ledger'){
  byId('modalTitle').textContent='Sổ cái TK '+a.code;
  body.innerHTML='<p>'+escape(a.name)+'</p><p class="note">Trong hệ thống, thao tác này mở Sổ cái (ACC11) với tài khoản '+a.code+' được chọn sẵn. Bản mẫu dùng dữ liệu minh họa.</p>';
  confirm.textContent='Đóng';
 } else {
  const disable=action==='disable';
  const blockers=[a.balance?'Tài khoản còn số dư.':'',a.defaultUse?'Tài khoản đang dùng trong cấu hình mặc định.':'',children(a.code).some(c=>c.active)?'Tài khoản còn tài khoản con đang sử dụng.':''].filter(Boolean);
  const parentInactive=a.parent&&!get(a.parent).active;
  byId('modalTitle').textContent=disable?'Ngừng sử dụng tài khoản':'Dùng lại tài khoản';
  body.innerHTML='<p><b>'+a.code+' · '+escape(a.name)+'</b></p>';
  if(disable&&blockers.length) body.innerHTML+='<p class="note">'+blockers.join(' ')+'</p>';
  else if(!disable&&parentInactive) body.innerHTML+='<p class="note">Cần kích hoạt lại tài khoản cha trước.</p>';
  else if(disable) body.innerHTML+='<p class="note">Tài khoản vẫn hiển thị trong sổ lịch sử và sẽ bị ẩn khi chọn tài khoản cho chứng từ mới.</p><label>Lý do<textarea id="reason" rows="3" required maxlength="300"></textarea></label><p id="error" class="err" role="alert"></p>';
  confirm.disabled=disable?Boolean(blockers.length):Boolean(parentInactive);
  confirm.className=disable?'danger':'primary';
  confirm.textContent=disable?'Ngừng sử dụng':'Dùng lại';
 }
 byId('modal').showModal();
}
byId('form').addEventListener('submit',event=>{
 event.preventDefault();
 const a=get(selected);
 if(mode==='add'){
  const parent=byId('parent').value;
  const code=byId('code').value.trim();
  const name=byId('name').value.trim();
  const error=!name?'Nhập tên tài khoản.':get(code)?'Mã tài khoản đã tồn tại.':!code.startsWith(parent)||code===parent?'Mã tài khoản phải bắt đầu bằng mã cha và có thêm chữ số.':'';
  if(error){byId('error').textContent=error;return}
  accounts.push(make(code,name,parent,{party:byId('party').value}));
  for(let cursor=parent;cursor;cursor=get(cursor).parent) collapsed.delete(cursor);
  selected=code;
  byId('search').value='';byId('status').value='';
  byId('notice').textContent='Đã thêm tài khoản '+code+'.';
 }else if(mode==='disable'||mode==='enable'){
  if(mode==='disable'&&!byId('reason')?.value.trim()){byId('error').textContent='Nhập lý do ngừng sử dụng.';return}
  a.active=mode==='enable';
  a.reason=a.active?'':byId('reason').value.trim();
  byId('notice').textContent=(a.active?'Đã dùng lại':'Đã ngừng sử dụng')+' tài khoản '+a.code+'.';
 }
 window.parent.postMessage({type:'acc14-update',account:get(selected)},'*');
 byId('modal').close();
 render();
});
function handleClick(event){
 const button=event.target.closest('button');
 if(!button)return;
 if(button.dataset.tree){const code=button.dataset.tree;collapsed.has(code)?collapsed.delete(code):collapsed.add(code);render();}
 if(button.dataset.code){selected=button.dataset.code;render();}
 if(button.dataset.action==='ledger')window.parent.postMessage({type:'acc14-ledger',code:selected,name:get(selected).name},'*');else if(button.dataset.action)openDialog(button.dataset.action);
}
byId('rows').addEventListener('click',handleClick);
byId('detail').addEventListener('click',handleClick);
byId('search').addEventListener('input',render);
byId('status').addEventListener('change',render);
byId('toggle').addEventListener('click',()=>{if(collapsed.size)collapsed.clear();else parents().forEach(a=>collapsed.add(a.code));render()});
byId('add').addEventListener('click',()=>openDialog('add'));
for(const id of ['close','cancel']) byId(id).addEventListener('click',()=>byId('modal').close());
render();
</script>
</body>
</html>
`;
