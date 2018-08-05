import * as React from "@barlus/react";
import {Component} from "@barlus/react";
import {style} from "@barlus/styles";
import {JsonInspectorProps} from "../../types";
import {objectStyles, styles} from "./json/style";
import {ObjectDescription} from "./json/ObjectDescription";
import {ObjectPreview} from "./json/ObjectPreview";

const DEFAULT_ROOT_PATH = 'root';

export class JsonInspector extends Component<JsonInspectorProps> {

    static defaultProps = {
        name: void 0,
        data: undefined,
        initialExpandedPaths: undefined,
        depth: 0,
        path: DEFAULT_ROOT_PATH
    };
    state = {} as any;

    constructor(props) {
        super(props);

        if (props.depth === 0) {
            this.state = {expandedPaths: {}};
            this.state.expandedPaths[props.path] = false;

            // initialize expandedPaths with initialExpandedPaths
            if (typeof props.initialExpandedPaths !== 'undefined') {
                props.initialExpandedPaths.map((expandedPath) => {
                    if (typeof expandedPath === 'string') {
                        const names = expandedPath.split('.'); // wildcard names
                        const paths = [];

                        function wildcardPathToPaths(curObject, curPath, i) {
                            const WILDCARD = "*";
                            if (i === names.length) {
                                paths.push(curPath);
                                return;
                            }
                            const name = names[i];
                            if (i === 0) {
                                if (name === props.name || name === DEFAULT_ROOT_PATH || name === WILDCARD) {
                                    wildcardPathToPaths(curObject, 'root', i + 1);
                                }
                            }
                            else {
                                if (name === WILDCARD) {
                                    for (const propertyName in curObject) {
                                        if (curObject.hasOwnProperty(propertyName)) {
                                            const propertyValue = curObject[propertyName];
                                            if (JsonInspector.isExpandable(propertyValue)) {
                                                wildcardPathToPaths(propertyValue, curPath + '.' + propertyName, i + 1);
                                            }
                                            else {
                                                continue;
                                            }
                                        }
                                    }
                                }
                                else {
                                    const propertyValue = curObject[name];
                                    if (JsonInspector.isExpandable(propertyValue)) {
                                        wildcardPathToPaths(propertyValue, curPath + '.' + name, i + 1);
                                    }
                                }
                            }
                        }

                        wildcardPathToPaths(props.data, '', 0);

                        paths.map((path) => {
                            this.state.expandedPaths[path] = true;
                        })
                    }
                });
            }
        }
    }

    static isExpandable(data) {
        return (typeof data === 'object' && data !== null && Object.keys(data).length > 0);
    }

    getExpanded(path) {
        const expandedPaths = this.state.expandedPaths;
        if (typeof expandedPaths[path] !== 'undefined') {
            return expandedPaths[path];
        }
        return false;
    }

    setExpanded(path, expanded) {
        const expandedPaths = this.state.expandedPaths;
        expandedPaths[path] = expanded;
        this.setState({expandedPaths: expandedPaths});
    }

    handleClick() {
        if (JsonInspector.isExpandable(this.props.data)) {
            if (this.props.depth > 0) {
                this.props.setExpanded(this.props.path, !this.props.getExpanded(this.props.path));
            }
            else {
                this.setExpanded(this.props.path, !this.getExpanded(this.props.path));
            }
        }
    }

    render() {

        const data = this.props.data;
        const name = this.props.name;

        const setExpanded = (this.props.depth === 0) ? (this.setExpanded.bind(this)) : this.props.setExpanded;
        const getExpanded = (this.props.depth === 0) ? (this.getExpanded.bind(this)) : this.props.getExpanded;
        const expanded = getExpanded(this.props.path);

        const expandGlyph = JsonInspector.isExpandable(data) ? (expanded ? '▼'
            : '▶')
            : (this.props.depth === 0 ? '' // unnamed root node
                : ' ');

        let propertyNodesContainer;
        if (expanded) {
            let propertyNodes = [];
            for (let propertyName in data) {
                const propertyValue = data[propertyName];
                if (data.hasOwnProperty(propertyName)) {
                    propertyNodes.push(
                        <JsonInspector
                            getExpanded={getExpanded}
                            setExpanded={setExpanded}
                            path={`${this.props.path}.${propertyName}`}
                            depth={this.props.depth + 1}
                            key={propertyName}
                            name={propertyName}
                            data={propertyValue}
                        />
                    );
                }
            }
            propertyNodesContainer = (<div style={styles.propertyNodesContainer}>{propertyNodes}</div>);
        }
        return (
            <div style={styles.base}>
                <span style={styles.property} onClick={this.handleClick.bind(this)}>
                  <span className={style({...styles.expandControl, ...styles.unselectable} as any)}>{expandGlyph}</span>
                    {(() => {
                        if (typeof name !== 'undefined') {
                            return (<span>
                                <span style={objectStyles.name}>{name}</span>
                                <span>: </span>
                                <ObjectDescription object={data}/>
                              </span>);
                        }
                        else {
                            return (<ObjectPreview object={data}/>);
                        }
                    })()}
                </span>
                {propertyNodesContainer}
            </div>
        );
    }
}


