(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.Catalog = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var GPIO_PINS = ["PA0","PA1","PA2","PA3","PA4","PA5","PA6","PA7","PA8","PA9","PA10","PA11","PA12","PA15",
                   "PB0","PB1","PB5","PB6","PB7","PB8","PB9","PB10","PB11","PB12","PB13","PB14","PB15",
                   "PC13"];

  var SERVO_CHANNELS = [
    { id: "TIM1_CH1", tim: "TIM1", chCode: "TIM_CHANNEL_1", pin: "PA8" },
    { id: "TIM1_CH2", tim: "TIM1", chCode: "TIM_CHANNEL_2", pin: "PA9" },
    { id: "TIM1_CH3", tim: "TIM1", chCode: "TIM_CHANNEL_3", pin: "PA10" },
    { id: "TIM1_CH4", tim: "TIM1", chCode: "TIM_CHANNEL_4", pin: "PA11" },
    { id: "TIM2_CH1", tim: "TIM2", chCode: "TIM_CHANNEL_1", pin: "PA0" },
    { id: "TIM2_CH2", tim: "TIM2", chCode: "TIM_CHANNEL_2", pin: "PA1" },
    { id: "TIM2_CH3", tim: "TIM2", chCode: "TIM_CHANNEL_3", pin: "PA2" },
    { id: "TIM2_CH4", tim: "TIM2", chCode: "TIM_CHANNEL_4", pin: "PA3" },
    { id: "TIM3_CH1", tim: "TIM3", chCode: "TIM_CHANNEL_1", pin: "PA6" },
    { id: "TIM3_CH2", tim: "TIM3", chCode: "TIM_CHANNEL_2", pin: "PA7" },
    { id: "TIM3_CH3", tim: "TIM3", chCode: "TIM_CHANNEL_3", pin: "PB0" },
    { id: "TIM3_CH4", tim: "TIM3", chCode: "TIM_CHANNEL_4", pin: "PB1" },
    { id: "TIM4_CH1", tim: "TIM4", chCode: "TIM_CHANNEL_1", pin: "PB6" },
    { id: "TIM4_CH2", tim: "TIM4", chCode: "TIM_CHANNEL_2", pin: "PB7" },
    { id: "TIM4_CH3", tim: "TIM4", chCode: "TIM_CHANNEL_3", pin: "PB8" },
    { id: "TIM4_CH4", tim: "TIM4", chCode: "TIM_CHANNEL_4", pin: "PB9" }
  ];
  SERVO_CHANNELS.forEach(function (c) { c.label = c.id + "（" + c.pin + "）"; });

  var PIN_OPTIONS = GPIO_PINS.map(function (p) { return { v: p, label: p }; });
  var CHANNEL_OPTIONS = SERVO_CHANNELS.map(function (c) { return { v: c.id, label: c.label }; });

  var CATALOG = {
    key: {
      label: "按键", declare: "Key",
      params: [
        { key: "pin", label: "引脚", type: "pin", options: PIN_OPTIONS },
        { key: "pull", label: "电阻", type: "select", options: [
            { v: "up", label: "上拉，另一端接 GND", code: "PULL_UP" },
            { v: "down", label: "下拉，另一端接 3V3", code: "PULL_DOWN" }] }
      ],
      states: [
        { id: "pressed", label: "被按下", code: "Key_IsPressed(&{n})" },
        { id: "released", label: "被松开", code: "Key_IsReleased(&{n})" }
      ],
      actions: [],
      initCode: "Key_Init(&{n}, {port}, {pin}, {pull})",
      comment: "按键({pin}, {pullLabel})"
    },
    ir: {
      label: "红外传感器", declare: "Ir",
      params: [
        { key: "pin", label: "引脚", type: "pin", options: PIN_OPTIONS },
        { key: "active", label: "触发逻辑", type: "select", options: [
            { v: "low", label: "低电平触发（检测到输出低）", code: "ACTIVE_LOW" },
            { v: "high", label: "高电平触发（检测到输出高）", code: "ACTIVE_HIGH" }] }
      ],
      states: [
        { id: "detected", label: "检测到", code: "Ir_IsTriggered(&{n})" },
        { id: "idle", label: "未检测到", code: "Ir_IsIdle(&{n})" }
      ],
      actions: [],
      initCode: "Ir_Init(&{n}, {port}, {pin}, {active})",
      comment: "红外({pin}, {activeLabel})"
    },
    led: {
      label: "LED", declare: "Led",
      params: [
        { key: "pin", label: "引脚", type: "pin", options: PIN_OPTIONS },
        { key: "active", label: "亮度逻辑", type: "select", options: [
            { v: "high", label: "高电平亮，另一端接 GND", code: "ACTIVE_HIGH" },
            { v: "low", label: "低电平亮，另一端接 3V3", code: "ACTIVE_LOW" }] }
      ],
      states: [],
      actions: [
        { id: "on", label: "亮", code: "Led_On(&{n});" },
        { id: "off", label: "灭", code: "Led_Off(&{n});" },
        { id: "toggle", label: "翻转", code: "Led_Toggle(&{n});" }
      ],
      initCode: "Led_Init(&{n}, {port}, {pin}, {active})",
      comment: "LED({pin}, {activeLabel})"
    },
    buzzer: {
      label: "蜂鸣器", declare: "Buzzer",
      params: [
        { key: "pin", label: "引脚", type: "pin", options: PIN_OPTIONS },
        { key: "active", label: "触发逻辑", type: "select", options: [
            { v: "high", label: "高电平响", code: "ACTIVE_HIGH" }, { v: "low", label: "低电平响", code: "ACTIVE_LOW" }] }
      ],
      states: [],
      actions: [
        { id: "on", label: "响", code: "Buzzer_On(&{n});" },
        { id: "off", label: "停", code: "Buzzer_Off(&{n});" },
        { id: "toggle", label: "翻转", code: "Buzzer_Toggle(&{n});" }
      ],
      initCode: "Buzzer_Init(&{n}, {port}, {pin}, {active})",
      comment: "蜂鸣器({pin}, {activeLabel})"
    },
    servo: {
      label: "舵机", declare: "Servo",
      params: [{ key: "channel", label: "定时器通道", type: "channel", options: CHANNEL_OPTIONS }],
      states: [],
      actions: [{ id: "write", label: "转到", param: "angle", paramLabel: "度",
                  paramType: "number", defaultParam: 90, min: 0, max: 180,
                  code: "Servo_Write(&{n}, {angle});" }],
      initCode: "Servo_Init(&{n}, {tim}, {chCode})",
      comment: "舵机({channel})"
    },
    oled: {
      label: "OLED屏", declare: "Oled",
      params: [],
      states: [],
      actions: [
        { id: "showyes", label: "显示 YES", code: "Oled_ShowText(&{n}, \"YES\");" },
        { id: "showno", label: "显示 NO", code: "Oled_ShowText(&{n}, \"NO\");" },
        { id: "showlow", label: "显示 LOW", code: "Oled_ShowText(&{n}, \"LOW\");" },
        { id: "showhigh", label: "显示 HIGH", code: "Oled_ShowText(&{n}, \"HIGH\");" },
        { id: "showvar", label: "显示变量", param: "var", paramType: "intref",
          code: "Oled_ShowInt(&{n}, {var});" },
        { id: "marquee", label: "跑马灯", param: "progress", paramLabel: "进度", paramType: "numref",
          defaultParam: 0, min: 0, max: 100,
          code: "Oled_Marquee(&{n}, {progress});   /* 跑马灯：显示进度 {progress} */" }
      ],
      initCode: "Oled_Init(&{n})",
      comment: "OLED(SSD1306 128x64, 软I2C PB8/PB9)"
    },
    int: {
      label: "整数", declare: "int",
      params: [{ key: "init", label: "初始值", type: "number", default: 0 }],
      states: [],
      actions: [
        { id: "set", label: "设为", param: "value", defaultParam: 0, code: "{n} = {value};" },
        { id: "add", label: "加", param: "value", defaultParam: 1, code: "{n} = {n} + {value};" },
        { id: "sub", label: "减", param: "value", defaultParam: 1, code: "{n} = {n} - {value};" }
      ],
      conditions: [
        { id: "ge", label: "≥", op: ">=" }, { id: "gt", label: ">", op: ">" },
        { id: "eq", label: "=", op: "=" }, { id: "le", label: "≤", op: "<=" },
        { id: "lt", label: "<", op: "<" }
      ],
      initCode: "{n} = {init}",
      comment: "整数({init})"
    }
  };

  function get(type) { return CATALOG[type]; }

  function labelOf(options, v) {
    for (var i = 0; i < options.length; i++) { if (options[i].v === v) { return options[i].label; } }
    return v;
  }
  function codeOf(options, v) {
    for (var i = 0; i < options.length; i++) { if (options[i].v === v) { return options[i].code || options[i].v; } }
    return v;
  }

  function pinLabel(pin) { return pin; }
  function channelLabel(id) { return id; }

  function gpioPortOf(pin) { return "GPIO" + pin.charAt(1); }
  function gpioPinMacroOf(pin) { return "GPIO_PIN_" + pin.slice(2); }

  function pinOfObject(obj) {
    if (obj.type === "servo") {
      for (var i = 0; i < SERVO_CHANNELS.length; i++) {
        if (SERVO_CHANNELS[i].id === obj.params.channel) { return SERVO_CHANNELS[i].pin; }
      }
      return null;
    }
    if (obj.type === "key" || obj.type === "led" || obj.type === "buzzer" || obj.type === "ir") {
      return obj.params.pin;
    }
    return null;
  }

  /* 该对象占用的全部引脚（OLED 软 I2C 固定占 PB8/PB9，视为两个） */
  function pinsOfObject(obj) {
    if (obj.type === "oled") { return ["PB8", "PB9"]; }
    var p = pinOfObject(obj);
    return p ? [p] : [];
  }

  return {
    GPIO_PINS: GPIO_PINS, SERVO_CHANNELS: SERVO_CHANNELS,
    TYPES: ["key", "ir", "led", "buzzer", "servo", "oled", "int"],
    get: get, labelOf: labelOf, codeOf: codeOf,
    pinLabel: pinLabel, channelLabel: channelLabel,
    gpioPortOf: gpioPortOf, gpioPinMacroOf: gpioPinMacroOf,
    pinOfObject: pinOfObject, pinsOfObject: pinsOfObject
  };
});
