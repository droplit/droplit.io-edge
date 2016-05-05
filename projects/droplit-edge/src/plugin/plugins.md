# About plugin loading

Plugin loading pseudocode:

```
var plugin = PluginFactory('PluginName');

PluginFactory('PluginName') => 
    pluginCluster { /* fork new host process for `pluginLoader` */ } =>
        pluginLoader { /* sandbox the plugin in a VM that loads pluginHost */ } => 
            pluginHost { /* create instance of plugin, send/rec cmds */ }
```