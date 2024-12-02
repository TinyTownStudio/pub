<script>
    let numbers = $state([1, 2, 3, 4])
    let total = $derived(numbers.reduce((t, n) => t + n, 0))
    function addNumber() {
        numbers[numbers.length] = numbers.length + 1
    }
</script>

<p>{numbers.join(' + ')} = {total}</p>

<button onclick={addNumber} class="px-4 py-2 text-white bg-black rounded">
    Add a number
</button>
