import { app } from "../../scripts/app.js";
import { IoDirection, PassThroughFollowing, followConnectionUntilType, getConnectedInputNodes, getConnectedInputNodesAndFilterPassThroughs, getConnectedNodesInfo, getConnectedOutputNodesAndFilterPassThroughs, shouldPassThrough, } from "./utils.js";
import { rgthree } from "./rgthree.js";
import { BaseContextNode } from "./context.js";
class ContextDynamicNodeBase extends BaseContextNode {
    constructor() {
        super(...arguments);
        this.hasShadowInputs = false;
    }
    getContextInputsList() {
        return this.inputs;
    }
    onConnectionsChainChange(arg) {
        console.log("ContextDynamicNodeBase: onConnectionsChainChange", this.id, arg);
    }
    onNodeCreated() {
        const inputs = this.getContextInputsList();
        if (inputs[inputs.length - 1].type === "*") {
            this.removeOutput(inputs.length - 1);
        }
        else {
            this.addInput("+", "*");
        }
    }
    getWidgets() {
        return Object.assign({}, super.getWidgets(), {
            DYNAMIC_CONTEXT_OUTPUTS: (node, inputName, inputData, app) => {
                node.addCustomWidget({
                    name: inputName,
                    value: "",
                    draw(ctx, node, width, posY, height) {
                        return;
                    },
                    computeSize(width) {
                        return [0, 0];
                    },
                    serializeValue() {
                        const value = (node.outputs || [])
                            .map((o, i) => i > 0 && o.name)
                            .filter((n) => n !== false)
                            .join(",");
                        return value;
                    },
                });
            },
        });
    }
    stripOwnedPrefix(name) {
        return name.replace(/^\+\s*/, "");
    }
    addOwnedPrefix(name) {
        return `+ ${this.stripOwnedPrefix(name)}`;
    }
    isOwnedInput(inputOrName) {
        const name = typeof inputOrName == "string" ? inputOrName : (inputOrName === null || inputOrName === void 0 ? void 0 : inputOrName.name) || "";
        return name.startsWith("+ ");
    }
    getNextUniqueNameForThisNode(desiredName) {
        const inputs = this.getContextInputsList();
        const allExistingKeys = inputs.map((i) => this.stripOwnedPrefix(i.name).toLocaleUpperCase());
        desiredName = this.stripOwnedPrefix(desiredName);
        let newName = desiredName;
        let n = 0;
        while (allExistingKeys.includes(newName.toLocaleUpperCase())) {
            newName = `${desiredName}.${++n}`;
        }
        return newName;
    }
    onConnectionsChange(type, slotIndex, isConnected, linkInfo, ioSlot) {
        var _a;
        (_a = super.onConnectionsChange) === null || _a === void 0 ? void 0 : _a.call(this, type, slotIndex, isConnected, linkInfo, ioSlot);
        if (this.configuring) {
            return;
        }
        if (type === LiteGraph.INPUT) {
            if (isConnected) {
                this.handleInputConnected(slotIndex);
            }
            else {
                this.handleInputDisconnected(slotIndex);
            }
        }
    }
    handleInputConnected(slotIndex) {
    }
    handleInputDisconnected(slotIndex) {
    }
    updateFromUpstream(update, node, updatedIndexes) {
    }
    provideInputsData() {
        const inputs = this.getContextInputsList();
        return inputs
            .map((input, index) => ({
            name: this.stripOwnedPrefix(input.name),
            type: String(input.type),
            index,
        }))
            .filter((i) => i.type !== "*");
    }
    updateDownstream(update, updatedIndexes) {
        var _a;
        const nodes = getConnectedOutputNodesAndFilterPassThroughs(this, this, 0);
        for (const node of nodes) {
            (_a = node === null || node === void 0 ? void 0 : node.updateFromUpstream) === null || _a === void 0 ? void 0 : _a.call(node, update, this, updatedIndexes);
        }
    }
    moveContextInput(slotFrom, slotTo) {
        if (slotFrom === slotTo) {
            return;
        }
        const inputs = this.getContextInputsList();
        let newIndex = slotTo + (slotFrom < slotTo ? -1 : 0);
        const input = inputs.splice(slotFrom, 1)[0];
        inputs.splice(newIndex, 0, input);
        this.outputs.splice(newIndex, 0, ...this.outputs.splice(slotFrom, 1));
        this.updateDownstream("move", { index: slotTo, from: slotFrom, name: input.name });
    }
    removeContextInput(slot) {
        if (this.hasShadowInputs) {
            const inputs = this.getContextInputsList();
            const input = inputs.splice(slot, 1)[0];
            if (this.outputs[slot]) {
                this.removeOutput(slot);
            }
            this.updateDownstream("disconnect", { index: slot, name: input.name });
        }
        else {
            this.removeInput(slot);
        }
    }
    addContextInput(name, type, slot = -1) {
        const inputs = this.getContextInputsList();
        if (this.hasShadowInputs) {
            inputs.push({ name, type });
        }
        else {
            this.addInput(name, type);
        }
        if (slot > -1) {
            inputs.splice(slot, 0, inputs.splice(inputs.length - 1, 1)[0]);
        }
        else {
            slot = inputs.length - 1;
        }
        if (type !== "*") {
            const output = this.addOutput(name.toUpperCase(), type);
            if (type === "COMBO" || String(type).includes(",") || Array.isArray(type)) {
                output.widget = true;
            }
            if (slot > -1) {
                this.outputs.splice(slot, 0, this.outputs.splice(this.outputs.length - 1, 1)[0]);
            }
            this.updateDownstream("connect", { index: slot, name });
        }
    }
}
class ContextDynamicNode extends ContextDynamicNodeBase {
    static setUp(comfyClass) {
        BaseContextNode.setUp(comfyClass, ContextDynamicNode);
    }
    constructor(title = ContextDynamicNode.title) {
        super(title);
    }
    clone() {
        const cloned = super.clone();
        while (cloned.inputs.length > 1) {
            cloned.removeInput(cloned.inputs.length - 1);
        }
        cloned.addInput("+", "*");
        return cloned;
    }
    removeInput(slot) {
        const input = this.inputs[slot];
        super.removeInput(slot);
        if (this.outputs[slot]) {
            this.removeOutput(slot);
        }
        this.updateDownstream("disconnect", { index: slot, name: input.name });
        this.stabilizeNames();
    }
    getSlotDefaultInputLabel(slot) {
        const inputs = this.getContextInputsList();
        const input = inputs[slot];
        let defaultLabel = this.stripOwnedPrefix(input.name).toLowerCase();
        return defaultLabel.toLocaleLowerCase();
    }
    updateFromUpstream(update, node, updatedIndexes) {
        console.log("----- ContextDynamicNode :: updateFromUpstream", arguments);
        const inputs = this.getContextInputsList();
        if (update == "connect") {
            const baseInputsData = node.provideInputsData();
            const baseIndex = updatedIndexes.index;
            const baseInputData = baseInputsData[baseIndex];
            const name = this.getNextUniqueNameForThisNode(baseInputData.name);
            this.addContextInput(name, baseInputData.type, baseIndex);
        }
        else if (update == "disconnect") {
            for (let index = inputs.length - 1; index > 0; index--) {
                if (index == 0) {
                    continue;
                }
                if (updatedIndexes.index === index) {
                    this.removeContextInput(index);
                }
            }
        }
        else if (update === "move") {
            this.moveContextInput(updatedIndexes.from, updatedIndexes.index);
        }
        else if (update == "update") {
            const baseInputsData = node.provideInputsData();
            const baseIndex = updatedIndexes.index;
            const baseInput = baseInputsData[baseIndex];
            inputs[baseIndex].name = this.stripOwnedPrefix(baseInput.name);
            this.outputs[baseIndex].name = inputs[baseIndex].name.toUpperCase();
            this.updateDownstream(update, updatedIndexes);
            this.stabilizeNames();
        }
        for (let index = inputs.length - 1; index > 0; index--) {
            const input = inputs[index];
            if ((input === null || input === void 0 ? void 0 : input.link) != null) {
                app.graph.links[input.link].target_slot = index;
            }
            const output = this.outputs[index];
            for (const link of (output === null || output === void 0 ? void 0 : output.links) || []) {
                app.graph.links[link].origin_slot = index;
            }
        }
        this.setSize(this.computeSize());
        this.setDirtyCanvas(true, true);
    }
    stabilizeNames() {
        const inputs = this.getContextInputsList();
        const names = [];
        for (const [index, input] of inputs.entries()) {
            if (index === 0 || index === inputs.length - 1) {
                continue;
            }
            input.label = undefined;
            this.outputs[index].label = undefined;
            let origName = this.stripOwnedPrefix(input.name).replace(/\.\d+$/, "");
            let name = input.name;
            if (!this.isOwnedInput(name)) {
                names.push(name.toLocaleUpperCase());
            }
            else {
                let n = 0;
                name = this.addOwnedPrefix(origName);
                while (names.includes(this.stripOwnedPrefix(name).toLocaleUpperCase())) {
                    name = `${this.addOwnedPrefix(origName)}.${++n}`;
                }
                names.push(this.stripOwnedPrefix(name).toLocaleUpperCase());
                if (input.name !== name) {
                    input.name = name;
                    this.outputs[index].name = this.stripOwnedPrefix(name).toLocaleUpperCase();
                    this.updateDownstream("update", { index, name });
                }
            }
        }
    }
    getSlotMenuOptions(info) {
        const opts = [];
        if (info.input) {
            if (this.isOwnedInput(info.input.name)) {
                opts.push({
                    content: "Rename Label",
                    callback: () => {
                        var dialog = app.canvas.createDialog("<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>", {});
                        var dialogInput = dialog.querySelector("input");
                        if (dialogInput) {
                            dialogInput.value = info.input.label || "";
                        }
                        var inner = () => {
                            app.graph.beforeChange();
                            let newName = dialogInput.value.trim() || this.getSlotDefaultInputLabel(info.slot);
                            const oldName = info.input.name;
                            info.input.name = newName;
                            if (this.isOwnedInput(oldName)) {
                                info.input.name = this.addOwnedPrefix(info.input.name);
                            }
                            else if (this.isOwnedInput(info.input.name)) {
                                info.input.name = this.stripOwnedPrefix(info.input.name);
                            }
                            this.outputs[info.slot].name = this.stripOwnedPrefix(info.input.name).toLocaleUpperCase();
                            this.updateDownstream("update", {
                                index: info.slot,
                                name: this.stripOwnedPrefix(info.input.name),
                            });
                            this.stabilizeNames();
                            this.setDirtyCanvas(true, true);
                            dialog.close();
                            app.graph.afterChange();
                        };
                        dialog.querySelector("button").addEventListener("click", inner);
                        dialogInput.addEventListener("keydown", (e) => {
                            var _a;
                            dialog.is_modified = true;
                            if (e.keyCode == 27) {
                                dialog.close();
                            }
                            else if (e.keyCode == 13) {
                                inner();
                            }
                            else if (e.keyCode != 13 && ((_a = e.target) === null || _a === void 0 ? void 0 : _a.localName) != "textarea") {
                                return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                        });
                        dialogInput.focus();
                    },
                });
                opts.push({
                    content: "Delete Input",
                    callback: () => {
                        this.removeInput(info.slot);
                    },
                });
            }
        }
        return opts;
    }
    handleInputConnected(slotIndex) {
        const inputs = this.getContextInputsList();
        const ioSlot = inputs[slotIndex];
        if (slotIndex === 0) {
            const baseNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, 0);
            const baseNodesDynamicCtx = baseNodes[0];
            if (baseNodesDynamicCtx === null || baseNodesDynamicCtx === void 0 ? void 0 : baseNodesDynamicCtx.provideInputsData) {
                for (const input of baseNodesDynamicCtx.provideInputsData()) {
                    if (input.name === "base_ctx" || input.name === "+") {
                        continue;
                    }
                    this.updateFromUpstream("connect", baseNodesDynamicCtx, {
                        name: input.name,
                        index: input.index,
                    });
                }
            }
        }
        else if (ioSlot.type === "*") {
            let cxn = null;
            if (ioSlot.link) {
                cxn = followConnectionUntilType(this, IoDirection.INPUT, slotIndex, true);
            }
            if (cxn === null || cxn === void 0 ? void 0 : cxn.type) {
                let name = cxn.name;
                if (name.match(/^(\+\s*)?[A-Z_]+$/)) {
                    name = name.toLowerCase();
                }
                name = this.getNextUniqueNameForThisNode(name);
                inputs[slotIndex].type = cxn.type;
                inputs[slotIndex].name = this.addOwnedPrefix(name);
                inputs[slotIndex].removable = true;
                if (!this.outputs[slotIndex]) {
                    this.addOutput("*", "*");
                }
                this.outputs[slotIndex].type = cxn.type;
                this.outputs[slotIndex].name = this.stripOwnedPrefix(name).toLocaleUpperCase();
                if (cxn.type === "COMBO" || cxn.type.includes(",") || Array.isArray(cxn.type)) {
                    this.outputs[slotIndex].widget = true;
                }
                this.addInput("+", "*");
                this.updateDownstream("connect", { index: slotIndex, name: this.stripOwnedPrefix(name) });
            }
        }
    }
    handleInputDisconnected(slotIndex) {
        var _a;
        const inputs = this.getContextInputsList();
        if (slotIndex === 0) {
            for (let index = inputs.length - 1; index > 0; index--) {
                if (index === 0 || index === inputs.length - 1) {
                    continue;
                }
                if (!this.isOwnedInput((_a = this.inputs[index]) === null || _a === void 0 ? void 0 : _a.name)) {
                    this.removeInput(index);
                }
            }
        }
    }
}
ContextDynamicNode.title = "Dynamic Context (rgthree)";
ContextDynamicNode.type = "Dynamic Context (rgthree)";
ContextDynamicNode.comfyClass = "Dynamic Context (rgthree)";
class ContextDynamicSwitchNode extends ContextDynamicNodeBase {
    constructor(title = ContextDynamicSwitchNode.title) {
        super(title);
        this.hasShadowInputs = true;
        this.lastInputsList = [];
        this.shadowInputs = [
            { name: "base_ctx", type: "DYNAMIC_CONTEXT" },
            { name: "+", type: "*" },
        ];
        let alerted = false;
        setInterval(() => {
            const plusIndex = this.shadowInputs.findIndex((i) => i.name === "+");
            if (plusIndex === -1) {
                !alerted && console.error("ERROR, no plus in shadow inputs", [...this.shadowInputs]);
                alerted = true;
            }
            else if (plusIndex !== this.shadowInputs.length - 1) {
                !alerted &&
                    console.error("ERROR, plus is not last in shadow inputs", [...this.shadowInputs]);
                alerted = true;
            }
            else {
                alerted && console.error("BACK TO NOREMAL", [...this.shadowInputs]);
                alerted = false;
            }
        });
    }
    static setUp(comfyClass) {
        BaseContextNode.setUp(comfyClass, ContextDynamicSwitchNode);
    }
    getContextInputsList() {
        return this.shadowInputs;
    }
    onNodeCreated() {
    }
    onConnectInput(inputIndex, outputType, outputSlot, outputNode, outputIndex) {
        let canConnect = true;
        if (super.onConnectInput) {
            canConnect = super.onConnectInput(inputIndex, outputType, outputSlot, outputNode, outputIndex);
        }
        const allConnectedNodes = getConnectedInputNodes(this);
        if (canConnect && allConnectedNodes.includes(outputNode)) {
            alert(`You may not connect the same context node to a switch.`);
            rgthree.showMessage({
                id: "dynamic-context-looped",
                type: "warn",
                message: "You may not connect the same context node to a switch.",
                timeout: 5000,
            });
            canConnect = false;
        }
        if (canConnect && shouldPassThrough(outputNode, PassThroughFollowing.REROUTE_ONLY)) {
            const connectedNodes = getConnectedInputNodesAndFilterPassThroughs(outputNode, undefined, undefined, PassThroughFollowing.REROUTE_ONLY);
            if (connectedNodes.length && allConnectedNodes.find((n) => connectedNodes.includes(n))) {
                rgthree.showMessage({
                    id: "dynamic-context-looped",
                    type: "warn",
                    message: "You may not connect the same context node to a switch, even through a reroute.",
                    timeout: 5000,
                });
                canConnect = false;
            }
        }
        return canConnect;
    }
    configure(info) {
        super.configure(info);
        setTimeout(() => {
            this.shadowInputs = this.getAllShadowInputs();
            this.shadowInputs.push({ name: "+", type: "*" });
            this.updateLastInputsList();
            console.log(this.shadowInputs);
        }, 100);
    }
    moveContextInput(slotFrom, slotTo) {
        super.moveContextInput(slotFrom, slotTo);
        this.updateLastInputsList();
    }
    removeContextInput(slot) {
        super.removeContextInput(slot);
        this.updateLastInputsList();
    }
    addContextInput(name, type, slot = -1) {
        super.addContextInput(name, type, slot);
        this.updateLastInputsList();
    }
    updateLastInputsList() {
        this.lastInputsList = this.getAllInputsList();
    }
    connectSlotFromUpdateOrInput(data) {
        console.log(`connectSlotFromUpdateOrInput: ${data.name}`, data);
        if (data.duplicatesBefore.length) {
            console.log(`[Do Nothing] It has duplicatesBefore (${data.duplicatesBefore.join(",")}).`);
            this.updateLastInputsList();
        }
        else if (data.duplicatesAfter.length) {
            const from = this.shadowInputs.findIndex((i) => i.name.toLocaleUpperCase() === data.key);
            console.log(`[Move] Has duplicates after. ${from} -> ${data.shadowIndex}`);
            this.moveContextInput(from, data.shadowIndex);
        }
        else {
            console.log(`[Add] No dupes, so we can add it at ${data.shadowIndex}.`);
            this.addContextInput(data.name, data.type, data.shadowIndex);
        }
    }
    updateFromUpstream(update, node, updatedSlotData) {
        var _a;
        console.log("----- ContextDynamicSwitchNode :: updateFromUpstream", update);
        const preInputsList = [...this.lastInputsList];
        const postInputsList = [...this.getAllInputsList()];
        if (shouldPassThrough(node)) {
            const connectedNodes = getConnectedNodesInfo(this, IoDirection.INPUT);
            const foundRerouteInfo = connectedNodes.find((n) => n.node === node);
            if (update == "connect") {
                this.handleInputConnected(foundRerouteInfo.originTravelFromSlot);
            }
            else if (update == "disconnect") {
                this.handleInputDisconnected(foundRerouteInfo.originTravelFromSlot);
            }
            else {
                throw new Error("Unexpected update type from pass through node: " + update);
            }
            return;
        }
        switch (update) {
            case "connect":
                const data = postInputsList.find((d) => {
                    return d.node == node && d.nodeIndex === updatedSlotData.index;
                });
                if (!data) {
                    throw new Error("Hmmm.. unfound input slot when connecting upstream.");
                }
                this.connectSlotFromUpdateOrInput(data);
                break;
            case "disconnect":
                const preInputData = preInputsList.find((i) => {
                    return i.node === node && i.nodeIndex == updatedSlotData.index;
                });
                if (!preInputData) {
                    throw new Error("Hmmm... no matching input found in existing input list for disconnect.");
                }
                if (preInputData.duplicatesBefore.length) {
                    console.log(`[Do Nothing] It was already duplicated before.`);
                    this.updateLastInputsList();
                }
                else if (((_a = preInputData === null || preInputData === void 0 ? void 0 : preInputData.duplicatesAfter) === null || _a === void 0 ? void 0 : _a[0]) != null) {
                    console.log(`[Move after] Not duplicated before, but is after.`);
                    this.moveContextInput(preInputData.shadowIndex, preInputData.duplicatesAfter[0]);
                }
                else {
                    console.log(`[Remove] ${preInputData.shadowIndex}.`, preInputData);
                    this.removeContextInput(preInputData.shadowIndex);
                }
                break;
        }
        console.log(this.shadowInputs);
    }
    handleInputConnected(slotIndex) {
        var _a;
        console.log("--- handleInputConnected", slotIndex);
        const postInputsList = [...this.getAllInputsList()];
        const node = (_a = postInputsList.find((i) => i.slot === slotIndex)) === null || _a === void 0 ? void 0 : _a.node;
        if (!node) {
            console.error("hmmm... no node foun to handle connect.");
            return;
        }
        const inputsDataLists = postInputsList.filter((d) => d.slot == slotIndex && d.nodeIndex > 0);
        for (const data of inputsDataLists) {
            this.connectSlotFromUpdateOrInput(data);
        }
    }
    handleInputDisconnected(slotIndex) {
        var _a;
        console.log("--- handleInputDisconnected", slotIndex);
        const preInputsList = [...this.lastInputsList];
        const node = (_a = preInputsList.find((i) => i.slot === slotIndex)) === null || _a === void 0 ? void 0 : _a.node;
        if (!node) {
            console.error("hmmmm... no node found to handle disconnect.");
            return;
        }
        const postInputsList = [...this.getAllInputsList()];
        const inputs = [...this.shadowInputs];
        console.log("postInputsList", postInputsList);
        let lastIndex = 0;
        for (let [index, data] of postInputsList.entries()) {
            data = this.getAllInputsList()[index];
            if (data.shadowIndex === -1 || data.nodeIndex === 0) {
                continue;
            }
            lastIndex++;
            const foundIndex = this.shadowInputs.findIndex((i) => i.name.toLocaleUpperCase() === data.key);
            console.log(data.name, foundIndex, data.shadowIndex);
            if (foundIndex !== data.shadowIndex) {
                this.moveContextInput(foundIndex, data.shadowIndex);
            }
        }
        while (this.shadowInputs[lastIndex + 1]) {
            console.log("remving", lastIndex + 1);
            this.removeContextInput(lastIndex + 1);
        }
        this.addContextInput("+", "*");
        console.log([...this.shadowInputs]);
    }
    getAllInputsList(indexToNodeOverride = {}) {
        var _a, _b, _c;
        const allConnectedInputsDataByName = {};
        const allConnectedInputsData = [];
        let currentShadowIndex = 0;
        for (const [slot, input] of (this.inputs || []).entries()) {
            const connectedNode = (_a = indexToNodeOverride[slot]) !== null && _a !== void 0 ? _a : (_b = getConnectedInputNodesAndFilterPassThroughs(this, this, slot)) === null || _b === void 0 ? void 0 : _b[0];
            if (connectedNode) {
                for (const inputData of connectedNode.provideInputsData()) {
                    const key = inputData.name.toLocaleUpperCase();
                    allConnectedInputsDataByName[key] = allConnectedInputsDataByName[key] || [];
                    const existings = allConnectedInputsDataByName[key];
                    let data = {
                        node: connectedNode,
                        slot,
                        shadowIndexFull: allConnectedInputsData.length,
                        shadowIndex: !existings.length ? currentShadowIndex : -1,
                        shadowIndexIfShownSingularly: currentShadowIndex,
                        nodeIndex: inputData.index,
                        type: inputData.type,
                        name: inputData.name,
                        key,
                        duplicatesBefore: allConnectedInputsDataByName[key].map((d) => d.shadowIndexFull),
                        duplicatesAfter: [],
                    };
                    if (data.shadowIndex > -1) {
                        currentShadowIndex++;
                    }
                    for (const existing of existings) {
                        existing.duplicatesAfter.push(data.shadowIndexFull);
                    }
                    allConnectedInputsData.push(data);
                    (_c = allConnectedInputsDataByName[key]) === null || _c === void 0 ? void 0 : _c.push(data);
                }
            }
        }
        return allConnectedInputsData;
    }
    getAllShadowInputs() {
        const inputsDataMap = {
            BASE_CTX: { name: "base_ctx", type: "DYNAMIC_CONTEXT", index: 0 },
        };
        const baseNodes = getConnectedInputNodesAndFilterPassThroughs(this, this);
        for (const inputNode of baseNodes) {
            for (const inputData of inputNode.provideInputsData()) {
                const dataKey = inputData.name.toLocaleUpperCase();
                const existingData = inputsDataMap[dataKey];
                if (!existingData) {
                    inputsDataMap[dataKey] = inputData;
                }
                else if (existingData.name !== inputData.name) {
                    throw new Error(`Conflicting data for ${dataKey}. ${existingData.name} !== ${inputData.name}`);
                }
                else if (existingData.type !== inputData.type) {
                    throw new Error(`Conflicting data for ${dataKey}. ${existingData.type} !== ${inputData.type}`);
                }
            }
        }
        return Object.values(inputsDataMap).map((v, index) => Object.assign({ ...v }, { index }));
    }
}
ContextDynamicSwitchNode.title = "Dynamic Context Switch (rgthree)";
ContextDynamicSwitchNode.type = "Dynamic Context Switch (rgthree)";
ContextDynamicSwitchNode.comfyClass = "Dynamic Context Switch (rgthree)";
const contextDynamicNodes = [ContextDynamicNode, ContextDynamicSwitchNode];
app.registerExtension({
    name: "rgthree.ContextDynamic",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        for (const ctxClass of contextDynamicNodes) {
            if (nodeData.name === ctxClass.type) {
                console.log(nodeData.name);
                ctxClass.nodeData = nodeData;
                ctxClass.nodeType = nodeType;
                ctxClass.setUp(nodeType);
                break;
            }
        }
    },
});