(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.Model = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NAME_BASE = { key: "key", led: "led", buzzer: "buzzer", servo: "servo", int: "count" };

  function newProject(name) {
    return { version: 1, projectName: name || "我的工程", objects: [], loop: [] };
  }

  function defaultName(project, type) {
    var base = NAME_BASE[type] || type;
    var n = 0;
    project.objects.forEach(function (o) { if (o.type === type) { n++; } });
    return base + (n + 1);
  }

  function addObject(project, type, params) {
    var maxN = 0;
    project.objects.forEach(function (o) {
      var n = parseInt(String(o.id).slice(1), 10);
      if (n > maxN) { maxN = n; }
    });
    var obj = { id: "o" + (maxN + 1), name: defaultName(project, type), type: type, params: params || {} };
    project.objects.push(obj);
    return obj;
  }

  function findObject(project, id) {
    for (var i = 0; i < project.objects.length; i++) {
      if (project.objects[i].id === id) { return project.objects[i]; }
    }
    return undefined;
  }

  function nodeReferences(node, objectId) {
    if (node.kind === "action") { return node.objectId === objectId; }
    if (node.kind === "if") {
      return (node.cond.kind === "state" || node.cond.kind === "compare")
        ? node.cond.objectId === objectId : false;
    }
    return false;
  }

  function cleanList(list, objectId) {
    var removed = 0;
    for (var i = list.length - 1; i >= 0; i--) {
      var node = list[i];
      if (nodeReferences(node, objectId)) { list.splice(i, 1); removed++; continue; }
      if (node.kind === "if") {
        removed += cleanList(node.then, objectId);
        removed += cleanList(node.else, objectId);
      }
    }
    return removed;
  }

  function deleteObject(project, id) {
    var removed = cleanList(project.loop, id);
    for (var i = 0; i < project.objects.length; i++) {
      if (project.objects[i].id === id) { project.objects.splice(i, 1); break; }
    }
    return removed;
  }

  function countReferences(project, id) {
    var n = 0;
    walk(project.loop, function (node) { if (nodeReferences(node, id)) { n++; } });
    return n;
  }

  function walk(nodes, fn) {
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      fn(node);
      if (node.kind === "if") { walk(node.then, fn); walk(node.else, fn); }
    }
  }

  function findParentList(project, node) {
    var found = null;
    (function scan(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] === node) { found = list; return; }
        if (list[i].kind === "if") {
          scan(list[i].then);
          if (found) { return; }
          scan(list[i].else);
          if (found) { return; }
        }
      }
    })(project.loop);
    return found;
  }

  function isListInside(node, list) {
    if (node.kind !== "if") { return false; }
    if (node.then === list || node.else === list) { return true; }
    for (var i = 0; i < node.then.length; i++) { if (isListInside(node.then[i], list)) { return true; } }
    for (var j = 0; j < node.else.length; j++) { if (isListInside(node.else[j], list)) { return true; } }
    return false;
  }

  function moveNode(project, node, targetList, targetIndex) {
    if (node.kind === "if" && isListInside(node, targetList)) { return false; }
    var from = findParentList(project, node);
    if (!from) { return false; }
    var idx = from.indexOf(node);
    from.splice(idx, 1);
    if (from === targetList && idx < targetIndex) { targetIndex--; }
    targetList.splice(targetIndex, 0, node);
    return true;
  }

  function nodeAction(objectId, action, value) {
    var n = { kind: "action", objectId: objectId, action: action };
    if (value !== undefined) { n.value = value; }
    return n;
  }
  function nodeDelay(ms) { return { kind: "delay", ms: ms }; }
  function nodeIf(cond, thenNodes, elseNodes) {
    return { kind: "if", cond: cond, then: thenNodes || [], else: elseNodes || [] };
  }
  function condState(objectId, state) { return { kind: "state", objectId: objectId, state: state }; }
  function condCompare(objectId, op, value) { return { kind: "compare", objectId: objectId, op: op, value: value }; }

  function findNodeByUid(project, uid) {
    var found = null;
    walk(project.loop, function (node) {
      if (!found && node.__uid === uid) { found = node; }
    });
    return found || undefined;
  }

  function deleteNodeByUid(project, uid) {
    var node = findNodeByUid(project, uid);
    if (!node) { return undefined; }
    var list = findParentList(project, node);
    if (!list) { return undefined; }
    list.splice(list.indexOf(node), 1);
    return node;
  }

  function serialize(project) {
    return JSON.stringify(project, function (k, v) { return k === "__uid" ? undefined : v; });
  }
  function deserialize(str) {
    var p = JSON.parse(str);
    if (p.version !== 1) { throw new Error("不支持的工程版本: " + p.version); }
    return p;
  }

  return {
    newProject: newProject, addObject: addObject, defaultName: defaultName,
    findObject: findObject, deleteObject: deleteObject, countReferences: countReferences,
    walk: walk, findParentList: findParentList, moveNode: moveNode,
    findNodeByUid: findNodeByUid, deleteNodeByUid: deleteNodeByUid,
    nodeAction: nodeAction, nodeDelay: nodeDelay, nodeIf: nodeIf,
    condState: condState, condCompare: condCompare,
    serialize: serialize, deserialize: deserialize
  };
});
