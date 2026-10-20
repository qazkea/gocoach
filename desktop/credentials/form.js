const input=document.querySelector('#key'),save=document.querySelector('#save'),cancel=document.querySelector('#cancel'),error=document.querySelector('#error');
const messages={invalid:'请输入 1–512 个可见 ASCII 字符，不能包含内部空白。',busy:'正在保存，请稍候。',unavailable:'密钥不可用，请重新配置。原凭据文件未主动删除。',denied:'窗口已失效，请重新打开。',cancelled:'操作已取消。'};
save.addEventListener('click',async()=>{
 save.disabled=true;error.textContent='';
 try {const result=await window.secretAPI.submitKey(input.value);error.textContent=messages[result]??'';}
 catch {error.textContent='操作未完成，请重新打开窗口。';}
 finally {input.value='';save.disabled=false;}
});
cancel.addEventListener('click',()=>{input.value='';void window.secretAPI.cancel().catch(()=>{});});
