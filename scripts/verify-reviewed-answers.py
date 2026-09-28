"""用保存的官方示例及专项边界验证本地参考题解；不运行用户提交的代码。

python scripts/verify-reviewed-answers.py --references <审核后的题库.json> --report <报告.json>
"""
import argparse
import ast
from collections import deque
from contextlib import redirect_stdout
import copy
import inspect
import io
import json
from pathlib import Path
import random
import re

class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val, self.left, self.right = val, left, right

class Node:
    def __init__(self, val=0, next=None, random=None):
        self.val, self.next, self.random = val, next, random

def linked(values):
    nodes = [ListNode(v) for v in values]
    for a, b in zip(nodes, nodes[1:]): a.next = b
    return (nodes[0] if nodes else None), nodes

def list_values(head):
    values, seen = [], set()
    while head:
        assert head not in seen, 'result unexpectedly contains a cycle'
        seen.add(head); values.append(head.val); head = head.next
    return values

def tree(values):
    if not values or values[0] is None: return None
    root = TreeNode(values[0]); queue = deque([root]); index = 1
    while queue and index < len(values):
        node = queue.popleft()
        for side in ('left', 'right'):
            if index == len(values): break
            if values[index] is not None:
                child = TreeNode(values[index]); setattr(node, side, child); queue.append(child)
            index += 1
    return root

def tree_values(root):
    values, queue, seen = [], deque([root]), set()
    while queue:
        node = queue.popleft()
        if node is None: values.append(None); continue
        assert node not in seen, 'tree unexpectedly reuses a node'
        seen.add(node); values.append(node.val); queue.extend((node.left, node.right))
    while values and values[-1] is None: values.pop()
    return values

def find_node(root, value):
    stack = [root]
    while stack:
        node = stack.pop()
        if not node: continue
        if node.val == value: return node
        stack.extend((node.left, node.right))
    raise AssertionError('node missing from example: ' + str(value))

def split_values(text):
    parts, start, depth, quote, escape = [], 0, 0, None, False
    for index, ch in enumerate(text):
        if quote:
            if escape: escape = False
            elif ch == '\\': escape = True
            elif ch == quote: quote = None
        elif ch in '\"\'': quote = ch
        elif ch in '[({': depth += 1
        elif ch in '])}': depth -= 1
        elif ch == ',' and depth == 0:
            parts.append(text[start:index].strip()); start = index + 1
    parts.append(text[start:].strip())
    return parts

def literal(text):
    try: return json.loads(text)
    except json.JSONDecodeError:
        return ast.literal_eval(re.sub(r'\bnull\b', 'None', text))

def arguments(text):
    result = {}
    for index, part in enumerate(split_values(text)):
        if '=' in part:
            name, value = part.split('=', 1); result[name.strip()] = literal(value.strip())
        else: result['arg' + str(index)] = literal(part)
    return result

LINK_INPUTS = {'add-two-numbers', 'remove-nth-node-from-end-of-list', 'merge-two-sorted-lists', 'swap-nodes-in-pairs',
               'reverse-nodes-in-k-group', 'sort-list', 'reverse-linked-list', 'palindrome-linked-list'}
LINK_OUTPUTS = LINK_INPUTS - {'palindrome-linked-list'} | {'merge-k-sorted-lists'}
MUTATIONS = {'next-permutation', 'rotate-image', 'set-matrix-zeroes', 'sort-colors', 'rotate-array', 'move-zeroes'}
UNORDERED = {'3sum', 'letter-combinations-of-a-phone-number', 'generate-parentheses', 'combination-sum', 'permutations',
             'group-anagrams', 'n-queens', 'subsets', 'palindrome-partitioning', 'top-k-frequent-elements'}
DATA_STRUCTURES = {'lru-cache', 'min-stack', 'implement-trie-prefix-tree', 'find-median-from-data-stream'}

def namespace(code):
    result = {'ListNode': ListNode, 'TreeNode': TreeNode, 'Node': Node}
    with redirect_stdout(io.StringIO()): exec(compile(code, '<reviewed-reference>', 'exec'), result)
    return result

def canonical(value, inner_sort=False):
    return sorted(tuple(sorted(item) if inner_sort else item) if isinstance(item, list) else item for item in value)

def check_example(slug, code, example):
    ns = namespace(code)
    if slug in DATA_STRUCTURES:
        lines = [line.strip() for line in example['input'].splitlines() if line.strip()]
        assert len(lines) == 2, (slug, lines)
        names, params = map(literal, lines)
        obj = ns[names[0]](*params[0]); output = [None]
        for name, args in zip(names[1:], params[1:]): output.append(getattr(obj, name)(*args))
        assert output == literal(example['output']), (slug, output)
        return
    data = arguments(example['input'])
    if 'Solution' in ns:
        obj = ns['Solution']()
        name = next(name for name in ns['Solution'].__dict__ if not name.startswith('_'))
        method = getattr(obj, name)
    else: method = ns['solve']
    params = list(inspect.signature(method).parameters)
    vals = list(data.values())
    aliases = {'list1': 'l1', 'list2': 'l2'}
    args = [data.get(aliases.get(name, name), vals[i] if i < len(vals) else None) for i, name in enumerate(params)]
    original = copy.deepcopy(args)
    expected_node = None
    original_nodes = None
    if slug in LINK_INPUTS:
        for i in range(2 if slug in {'add-two-numbers', 'merge-two-sorted-lists'} else 1): args[i], _ = linked(args[i])
    elif slug == 'merge-k-sorted-lists': args[0] = [linked(values)[0] for values in args[0]]
    elif slug in {'linked-list-cycle', 'linked-list-cycle-ii'}:
        args[0], nodes = linked(data['head'])
        pos = data['pos']
        if pos >= 0: nodes[-1].next = nodes[pos]; expected_node = nodes[pos]
    elif slug == 'intersection-of-two-linked-lists':
        a, anodes = linked(data['listA']); b, bnodes = linked(data['listB'])
        if data['intersectVal']:
            expected_node = anodes[data['skipA']]
            if data['skipB']: bnodes[data['skipB'] - 1].next = expected_node
            else: b = expected_node
        args = [a, b]
    elif slug == 'copy-list-with-random-pointer':
        original_nodes = [Node(v) for v, _ in args[0]]
        for i, (_, random_index) in enumerate(args[0]):
            original_nodes[i].next = original_nodes[i+1] if i+1 < len(original_nodes) else None
            original_nodes[i].random = original_nodes[random_index] if random_index is not None else None
        args[0] = original_nodes[0] if original_nodes else None
    elif 'root' in data:
        args[0] = tree(data['root'])
        if slug == 'lowest-common-ancestor-of-a-binary-tree':
            args[1] = find_node(args[0], data['p']); args[2] = find_node(args[0], data['q'])
            expected_node = find_node(args[0], literal(example['output']))
    if slug == 'palindrome-linked-list':
        before = list_values(args[0])
    output = method(*args)
    if slug in {'linked-list-cycle-ii', 'intersection-of-two-linked-lists', 'lowest-common-ancestor-of-a-binary-tree'}:
        assert output is expected_node, slug
        return
    expected = literal(example['output'])
    if slug in MUTATIONS: output = args[0]
    elif slug in LINK_OUTPUTS: output = list_values(output)
    elif slug in {'construct-binary-tree-from-preorder-and-inorder-traversal', 'invert-binary-tree'}: output = tree_values(output)
    elif slug == 'flatten-binary-tree-to-linked-list':
        node = args[0]
        while node:
            assert node.left is None, 'flatten left pointer not cleared'; node = node.right
        output = tree_values(args[0])
    elif slug == 'convert-sorted-array-to-binary-search-tree':
        def inspect_tree(node):
            if not node: return [], 0
            left, lh = inspect_tree(node.left); right, rh = inspect_tree(node.right)
            assert abs(lh-rh) <= 1, 'BST not balanced'
            return left+[node.val]+right, 1+max(lh,rh)
        ordered, _ = inspect_tree(output)
        assert ordered == original[0], slug
        return
    elif slug == 'copy-list-with-random-pointer':
        copies, node = [], output
        while node:
            assert node not in original_nodes and node not in copies, 'copy must use new distinct nodes'
            copies.append(node); node = node.next
        output = [[node.val, copies.index(node.random) if node.random else None] for node in copies]
    elif slug == 'two-sum':
        assert len(output) == 2 and output[0] != output[1], slug
        assert sum(original[0][i] for i in output) == original[1], slug
        return
    elif slug == 'longest-palindromic-substring':
        assert len(output) == len(expected) and output == output[::-1] and output in original[0], slug
        return
    if slug == 'palindrome-linked-list': assert list_values(args[0]) == before, 'input list must be restored'
    if slug in UNORDERED:
        inner = slug in {'3sum', 'combination-sum', 'group-anagrams', 'subsets'}
        assert canonical(output, inner) == canonical(expected, inner), (slug, output, expected)
    else: assert output == expected, (slug, output, expected)

def deep_checks(references):
    lookup = {r['slug']: r for r in references}
    def method(slug, name): return getattr(namespace(lookup[slug]['code'])['Solution'](), name)
    def chain(length, value=None):
        root = TreeNode(0 if value is None else value); tail = root
        for i in range(1, length): tail.right = TreeNode(i if value is None else value); tail = tail.right
        return root, tail
    root, tail = chain(10000)
    assert method('maximum-depth-of-binary-tree','maxDepth')(root) == 10000
    assert method('validate-binary-search-tree','isValidBST')(root) is True
    assert method('diameter-of-binary-tree','diameterOfBinaryTree')(root) == 9999
    parent = root
    while parent.right is not tail: parent = parent.right
    assert method('lowest-common-ancestor-of-a-binary-tree','lowestCommonAncestor')(root,parent,tail) is parent
    ones, _ = chain(10000, 1)
    assert method('binary-tree-maximum-path-sum','maxPathSum')(ones) == 10000
    zeros, _ = chain(1000, 0)
    assert method('path-sum-iii','pathSum')(zeros,0) == 500500
    built = method('construct-binary-tree-from-preorder-and-inorder-traversal','buildTree')(list(range(3000)),list(range(3000)))
    length = 0
    while built:
        assert built.left is None and built.val == length
        length += 1; built = built.right
    assert length == 3000
    assert method('number-of-islands','numIslands')([['1']*300 for _ in range(300)]) == 1
    return 8

def randomized_checks(references):
    lookup = {r['slug']: r for r in references}; rng = random.Random(20260928); count = 0
    def method(slug, name): return getattr(namespace(lookup[slug]['code'])['Solution'](), name)
    kth = method('kth-largest-element-in-an-array','findKthLargest')
    rotate = method('rotate-array','rotate')
    maximum = method('maximum-subarray','maxSubArray')
    consecutive = method('longest-consecutive-sequence','longestConsecutive')
    palindrome = method('palindrome-linked-list','isPalindrome')
    for _ in range(80):
        values = [rng.randint(-10,10) for _ in range(rng.randint(1,24))]
        k = rng.randint(1,len(values)); assert kth(values[:], k) == sorted(values,reverse=True)[k-1]; count += 1
        moved = values[:]; shift = rng.randint(0,80); rotate(moved,shift)
        actual_shift = shift % len(values)
        assert moved == values[-actual_shift:]+values[:-actual_shift] if actual_shift else moved == values
        count += 1
        expected = max(sum(values[i:j]) for i in range(len(values)) for j in range(i+1,len(values)+1))
        assert maximum(values) == expected; count += 1
        ordered = sorted(set(values)); best = length = 0; previous = None
        for value in ordered:
            length = length + 1 if previous is not None and value == previous+1 else 1
            best = max(best,length); previous = value
        assert consecutive(values) == best; count += 1
        head, nodes = linked(values); links = [node.next for node in nodes]
        assert palindrome(head) == (values == values[::-1])
        assert [node.next for node in nodes] == links; count += 1
    return count

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--references',required=True); parser.add_argument('--report',required=True)
    args = parser.parse_args(); references = json.loads(Path(args.references).read_text(encoding='utf-8'))
    results, failures, version_count, example_count = [], [], 0, 0
    for reference in references:
        variants = [('主答案', reference['code'])] + [(v['kind'],v['code']) for v in reference['variants'] if v.get('code')]
        if reference.get('hardcode',{}): variants += [('独立示例',reference['hardcode']['code'])] if reference['hardcode'].get('code') else []
        passed = 0
        for kind, code in variants:
            version_count += 1
            ast.parse(code)
            assert any(line.lstrip().startswith('#') for line in code.splitlines()), reference['slug']+' needs comments'
            for index, example in enumerate(reference['examples']):
                try:
                    check_example(reference['slug'],code,example); passed += 1; example_count += 1
                except Exception as error:
                    failures.append({'slug':reference['slug'],'kind':kind,'example':index+1,'error':str(error)})
        results.append({'slug':reference['slug'],'number':reference['number'],'title':reference['title'],'versions':len(variants),'examplesPassed':passed})
    assert all(r['examplesPassed'] > 0 for r in results), 'every problem needs an executed example'
    if not failures:
        deep = deep_checks(references); randomized = randomized_checks(references)
    else: deep = randomized = 0
    report = {'problems':len(results),'codeVersions':version_count,'officialExamplesPassed':example_count,
              'deepBoundaryChecks':deep,'randomizedChecks':randomized,'failures':failures,'perProblem':results}
    Path(args.report).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='perProblem'},ensure_ascii=False,indent=2))
    assert not failures, 'reviewed answers failed validation'

if __name__ == '__main__': main()
