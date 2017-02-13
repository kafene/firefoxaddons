/// Static variables
var selectedText = "";
var lastTabId = -1;
var globalAction = "";

//the addons icon is a modified version of http://www.flaticon.com/free-icon/translator-tool_69101
//see their website for licensing information

var translate_now_destination_language;
var translate_now_source_language;
var translate_now_reuse_tab;
var translate_now_enable_speak;

function init(){
	var valueOrDefault = function(value, defaultValue){
		if(value == undefined)
			return defaultValue;
		return value;
	}
	
	browser.storage.local.get([
		"translate_now_destination_language",
		"translate_now_source_language",
		"translate_now_reuse_tab",
		"translate_now_enable_speak"
	]).then((result) => {
		//console.log("background.js result" + JSON.stringify(result));
		//console.log("background.js setDestinationLanguage " + result.translate_now_destination_language);
		translate_now_destination_language = valueOrDefault(result.translate_now_destination_language, "en");
	
		//console.log("background.js setSourceLanguage " + result.translate_now_source_language);
		translate_now_source_language = valueOrDefault(result.translate_now_source_language, "auto");
	
		//console.log("background.js setReuseTab " + result.translate_now_reuse_tab);
		translate_now_reuse_tab = valueOrDefault(result.translate_now_reuse_tab, true);
	
		//console.log("background.js setEnableSpeak " + result.translate_now_enable_speak);
		translate_now_enable_speak = valueOrDefault(result.translate_now_enable_speak, false);
		
		initContextMenus();
	}).catch(console.error);
	
}
init();

///Messages
// listen for messages from the content or options script
browser.runtime.onMessage.addListener(function(message) {
	switch (message.action) {
		case "refresh-options":
			init();
			break;
		case "setSelection":
			setSelection(message.data);
			break;
		case "notify":
			notify(message.data);
			break;
		default:
			break;
	}
});

// See also https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/Tabs/sendMessage
function sendMessage(action, data){
	function logTabs(tabs) {
		for (tab of tabs) {
			// tab.url requires the tabs permission
			//console.log(tab.url);
			browser.tabs.sendMessage(tab.id, {"action": action, "data": data});
		}
	}

	var querying = browser.tabs.query({currentWindow: true, active: true});
	querying.then(logTabs, onError);
}

/// Context menus
function initContextMenus(){
	
	try{
		browser.contextMenus.onClicked.removeListener(listener);
		browser.contextMenus.removeAll();
	}catch(ex){
		console.log("contextMenu remove failed: " + ex);
	}
	
	browser.contextMenus.create({
		id: "translatenow-translate",
		title: "Translate Now",
		contexts: ["selection"]
	}, onCreated);

	if(translate_now_enable_speak){
		browser.contextMenus.create({
			id: "translatenow-speak",
			title: "Speak with Google Translate Voice",
			contexts: ["selection"]
		}, onCreated);
	}

	function onCreated(n) {
		if (browser.runtime.lastError) {
			console.log(`Error: ${browser.runtime.lastError}`);
		}
	}
	
	browser.contextMenus.onClicked.addListener(listener);
}

function listener(info,tab){
	switch (info.menuItemId) {
		case "translatenow-translate":
			doClick(info.selectionText, "translate");
			break;
		case "translatenow-speak":
			doClick(info.selectionText, "speak");
			break;
	}
}

/// Translate Now Code
function openTab(url){
	//console.log("openTab for url " + url);
	//console.log("lastTabId is " + lastTabId);
	//console.log("translate_now_reuse_tab is " + translate_now_reuse_tab);

	if(lastTabId != -1 && translate_now_reuse_tab){
		var gettingInfo = browser.tabs.get(lastTabId);
		gettingInfo.then(onGot, onError);
					
		function onGot(tabInfo) {
			//console.log("tab exists");
			
			var updating = browser.tabs.update(lastTabId, {
				active: true,
				url: url
			}).then(
				function(data){
					//console.log(1, 'success', JSON.stringify(data));
				},
				function(error){
					notify("Failed to update tab");
					lastTabId = -1;
				}
			);
		}

		function onError(error) {
			openTabInner(url);
		}
	}else{
		openTabInner(url);
	}
}

function openTabInner(url){
	var creating = browser.tabs.create({
		url: url,
		active: true
	}).then(onCreated, onError);
	
	function onCreated(tab){
		lastTabId = tab.id;
	}
}

function doClick(selectionText, action){
	// Ideally, we want to do this
	// doAction(selectionText, action);
	
	// But we now do this to circumvent https://bugzilla.mozilla.org/show_bug.cgi?id=1338898
	globalAction = action;
	sendMessage("getSelection");
}

function doAction(selectionText, action){
	if(selectionText != "" || selectionText == null){
		selectedText = selectionText;
		//console.log("selectionText length is " + selectionText.length);
	}
	if(selectedText == null){
		notify("Try another selection");
	}else{
		if(selectedText.length > 195 && action == "speak"){
			notify("Selected text is too long. Maximum length is 195.");
		}else{
			var newText = selectedText;
			newText = encodeURIComponent(newText);
			newText = newText.replace("%25", "");
			newText = newText.replace("%C2%A0", " ");
			if(action == "speak"){
				openTab("http://translate.google.com/translate_tts?tl=en&client=tw-ob&q=" + newText);
			}else{
				openTab("http://translate.google.com/#" + translate_now_source_language + "/" + translate_now_destination_language + "/" + newText);
			}
		}
	}
}

function setSelection(selectionText){
	doAction(selectionText, globalAction);
}

/// Helper functions
function onError(error) {
	console.log(`Error: ${error}`);
}

function notify(message){
	browser.notifications.create({
		type: "basic",
		iconUrl: browser.extension.getURL("icons/translatenow-64.png"),
		title: "Translate Now",
		message: message
	});
}
