import * as React           from "@barlus/react/index";
import {Component}          from "@barlus/react/index";
import {ObjectDescription}  from "./ObjectDescription";
import {objectStyles}       from "./style";

export class ObjectPreview extends Component<{ maxProperties?: number, object? }> {

    static defaultProps = {
        maxProperties: 5
    };

    static intersperse(arr, sep) {
        if (arr.length === 0) {
            return [];
        }

        return arr.slice(1).reduce(function (xs, x, i) {
            return xs.concat([sep, x]);
        }, [arr[0]]);
    }

    render() {
        const { intersperse } = ObjectPreview;
        const object = this.props.object;
        if (typeof object !== 'object' || object === null) {
            return (<ObjectDescription object={object}/>);
        }

        if (Array.isArray(object)) {
            return <span style={{
                fontStyle: 'italic',
            }}> {
                intersperse(object.map(function (element, index) {
                    return (<ObjectDescription key={index} object={element}/>)
                }), ", ")
            }}</span>;
        }
        else if (object instanceof Date) {
            return <span>{object.toString()}</span>;
        }
        else {
            let propertyNodes = [];
            for (let propertyName in object) {
                const propertyValue = object[propertyName];
                if (object.hasOwnProperty(propertyName)) {
                    let ellipsis;
                    if (propertyNodes.length === (this.props.maxProperties - 1)
                        && Object.keys(object).length > this.props.maxProperties) {
                        ellipsis = (<span key={'ellipsis'}>…</span>);
                    }
                    propertyNodes.push(
                        <span key={propertyName}>
              <span style={objectStyles.name}>{propertyName}</span>
              :&nbsp;
                            <ObjectDescription object={propertyValue}/>
                            {ellipsis}
            </span>
                    );
                    if (ellipsis)
                        break;
                }
            }

            return (<span style={{
                fontStyle: 'italic',
            }}>
                  {'Object {'}
                {intersperse(propertyNodes, ", ")}
                {'}'}
              </span>);
        }
    }
}