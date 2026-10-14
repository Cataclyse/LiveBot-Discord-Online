import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageFallback, componentText, channelPermissions, Permissions, mayDeleteMessage } from '../message-model.js';

test('system events and rich messages are not misidentified as restricted text', () => {
  assert.equal(messageFallback({type:7,content:''}).kind,'system');
  for(const message of [{sticker_items:[{id:'1'}]},{poll:{question:{text:'Question'}}},{components:[{type:10,content:'Texte'}]},{message_snapshots:[{message:{content:'Transféré'}}]}])assert.equal(messageFallback(message).kind,'payload');
  assert.equal(messageFallback({type:0,content:'',attachments:[],embeds:[]}).kind,'unavailable');
  assert.equal(messageFallback({type:19,content:'réponse'}).kind,'payload');
});
test('nested Discord component text is recovered',()=>{
  assert.deepEqual(componentText([{type:17,components:[{type:9,components:[{type:10,content:'Texte **gras**'}]}]}]),['Texte **gras**']);
});
test('channel overrides apply everyone, combined roles then personal permissions',()=>{
  const guild={id:'1'},roles=[{id:'1',permissions:String(Permissions.VIEW_CHANNEL|Permissions.SEND_MESSAGES)},{id:'2',permissions:String(Permissions.MANAGE_MESSAGES)}],member={roles:['2']};
  const channel={permission_overwrites:[{id:'1',type:0,deny:String(Permissions.SEND_MESSAGES),allow:'0'},{id:'2',type:0,allow:String(Permissions.SEND_MESSAGES),deny:'0'},{id:'3',type:1,deny:String(Permissions.MANAGE_MESSAGES),allow:'0'}]};
  const permissions=channelPermissions(guild,channel,roles,member,'3');
  assert.ok(permissions&Permissions.SEND_MESSAGES);assert.equal(Boolean(permissions&Permissions.MANAGE_MESSAGES),false);
  assert.equal(mayDeleteMessage({author:{id:'4'}},'3',permissions),false);assert.equal(mayDeleteMessage({author:{id:'3'}},'3',permissions),true);
});
test('administrator bypasses overwrites and unknown permissions stay unknown',()=>{
  assert.equal(channelPermissions({id:'1'},{permission_overwrites:[{id:'1',type:0,deny:String(Permissions.VIEW_CHANNEL)}]},[{id:'1',permissions:'8'}],{roles:[]},'3')&Permissions.MANAGE_CHANNELS,Permissions.MANAGE_CHANNELS);
  assert.equal(channelPermissions({id:'1'},{},null,null,'3'),null);
  assert.equal(mayDeleteMessage({author:{id:'4'}},'3',null),false);
  assert.equal(channelPermissions(null,{type:1},null,null,'3')&Permissions.MANAGE_MESSAGES,0n);
});
